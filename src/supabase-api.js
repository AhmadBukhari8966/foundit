import { createClient } from "@supabase/supabase-js";
import { embed } from "./browser-clip.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
let client;
const fields =
  "id,title,description,category,location,date,pickup_notes,is_sample,image_path";
function db() {
  if (!url || !key)
    throw new Error(
      "Hosted configuration is incomplete: set the Supabase URL and public publishable/anon key.",
    );
  return (client ??= createClient(url, key));
}
function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
function item(row) {
  const { image_path, ...rest } = row;
  return {
    ...rest,
    image: db().storage.from("foundit-photos").getPublicUrl(image_path).data
      .publicUrl,
  };
}
function verifyDates(from, to) {
  if (from && to && from > to)
    throw new Error("Start date must not be after end date.");
}
export async function hostedApi(path, options = {}) {
  const parsed = new URL(path, "https://foundit.invalid");
  const params = parsed.searchParams;
  if (options.signal?.aborted)
    throw new DOMException("Cancelled", "AbortError");
  if (parsed.pathname === "/items" && options.method !== "POST") {
    verifyDates(params.get("date_from"), params.get("date_to"));
    const limit = Math.min(
      100,
      Math.max(1, Number(params.get("limit") || 100)),
    );
    let query = db()
      .from("foundit_items")
      .select(fields)
      .order("id")
      .limit(limit + 1);
    for (const field of ["category", "location"])
      if (params.get(field)) query = query.eq(field, params.get(field));
    if (params.get("date_from"))
      query = query.gte("date", params.get("date_from"));
    if (params.get("date_to")) query = query.lte("date", params.get("date_to"));
    if (params.get("offset")) query = query.gt("id", params.get("offset"));
    if (options.signal) query = query.abortSignal(options.signal);
    const rows = check(await query);
    return {
      items: rows.slice(0, limit).map(item),
      next_offset: rows.length > limit ? rows[limit - 1].id : null,
    };
  }
  if (parsed.pathname === "/items" && options.method === "POST") {
    const data = options.body;
    const photo = data.get("image");
    if (!(photo instanceof Blob) || photo.size > 8 * 1024 * 1024)
      throw new Error("Choose a photo smaller than 8 MB.");
    // Establish an anonymous authenticated session. The database enforces ownership.
    let session = check(await db().auth.getSession()).session;
    if (!session) session = check(await db().auth.signInAnonymously()).session;
    if (!session)
      throw new Error(
        "Could not establish a posting session. Enable anonymous sign-ins in Supabase.",
      );
    const vector = await embed("image", photo);
    const id = crypto.randomUUID();
    const path = `${session.user.id}/${id}.jpg`;
    check(
      await db()
        .storage.from("foundit-photos")
        .upload(path, photo, { contentType: "image/jpeg", upsert: false }),
    );
    try {
      const row = {
        id,
        owner_id: session.user.id,
        image_path: path,
        embedding: vector,
        title: data.get("title"),
        description: data.get("description"),
        category: data.get("category"),
        location: data.get("location"),
        date: data.get("found_date"),
        pickup_notes: data.get("pickup_notes") || "",
      };
      return item(
        check(
          await db().from("foundit_items").insert(row).select(fields).single(),
        ),
      );
    } catch (error) {
      await db().storage.from("foundit-photos").remove([path]);
      throw error;
    }
  }
  if (parsed.pathname.startsWith("/items/")) {
    return item(
      check(
        await db()
          .from("foundit_items")
          .select(fields)
          .eq("id", parsed.pathname.split("/").at(-1))
          .single(),
      ),
    );
  }
  const isImage = parsed.pathname === "/search/image";
  if (isImage || parsed.pathname === "/search/text") {
    const data = isImage
      ? Object.fromEntries(options.body)
      : JSON.parse(options.body);
    verifyDates(data.date_from, data.date_to);
    const vector = await embed(
      isImage ? "image" : "text",
      isImage ? data.image : data.query,
    );
    if (options.signal?.aborted)
      throw new DOMException("Cancelled", "AbortError");
    const response = db().rpc("match_foundit_items", {
      query_embedding: vector,
      match_count: Number(data.limit || 100),
      filter_category: data.category || null,
      filter_location: data.location || null,
      date_from: data.date_from || null,
      date_to: data.date_to || null,
    });
    const rows = check(
      await (options.signal ? response.abortSignal(options.signal) : response),
    );
    return { items: rows.map(item) };
  }
  throw new Error("Unknown hosted API operation.");
}
