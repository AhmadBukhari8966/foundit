let worker;
let nextId = 0;
const pending = new Map();
export function embed(kind, value) {
  if (!worker) {
    worker = new Worker(new URL("./clip.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if ("progress" in data) {
        window.dispatchEvent(
          new CustomEvent("foundit-model-progress", { detail: data.progress }),
        );
        return;
      }
      const request = pending.get(data.id);
      if (!request) return;
      pending.delete(data.id);
      if (data.error)
        request.reject(new Error(`Browser CLIP could not run: ${data.error}`));
      else request.resolve(data.vector);
    };
    worker.onerror = () => {
      for (const request of pending.values())
        request.reject(
          new Error(
            "Browser CLIP could not start. Try a current Chrome browser.",
          ),
        );
      pending.clear();
      worker.terminate();
      worker = null;
      window.dispatchEvent(
        new CustomEvent("foundit-model-progress", { detail: "" }),
      );
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, kind, value });
  });
}
