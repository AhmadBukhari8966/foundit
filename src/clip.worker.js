import {
  AutoTokenizer,
  AutoProcessor,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from "@huggingface/transformers";

// A single WASM thread works on static hosts without cross-origin isolation.
// Run inference off the UI thread, using the same checkpoint for both inputs.
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
const checkpoint = "Xenova/clip-vit-base-patch32";
let textResources;
let imageResources;
const progress = (event) => {
  if (event.status === "progress")
    self.postMessage({
      progress: `Downloading CLIP: ${event.file} (${Math.round(event.progress || 0)}%)`,
    });
};
async function encode(kind, value) {
  self.postMessage({
    progress: "Preparing browser CLIP. The first run downloads model files.",
  });
  let output;
  if (kind === "text") {
    textResources ??= Promise.all([
      AutoTokenizer.from_pretrained(checkpoint),
      CLIPTextModelWithProjection.from_pretrained(checkpoint, {
        dtype: "q8",
        device: "wasm",
        progress_callback: progress,
      }),
    ]).catch((error) => {
      textResources = null;
      throw error;
    });
    const [tokenizer, model] = await textResources;
    const input = await tokenizer(value, {
      padding: true,
      truncation: true,
      max_length: 77,
    });
    output = (await model(input)).text_embeds.data;
  } else {
    imageResources ??= Promise.all([
      AutoProcessor.from_pretrained(checkpoint),
      CLIPVisionModelWithProjection.from_pretrained(checkpoint, {
        dtype: "q8",
        device: "wasm",
        progress_callback: progress,
      }),
    ]).catch((error) => {
      imageResources = null;
      throw error;
    });
    const [processor, model] = await imageResources;
    const image = await RawImage.fromBlob(value);
    output = (await model(await processor(image))).image_embeds.data;
  }
  const norm = Math.sqrt(Array.from(output).reduce((sum, x) => sum + x * x, 0));
  if (output.length !== 512 || !Number.isFinite(norm) || norm === 0)
    throw new Error("CLIP returned an invalid embedding.");
  return Array.from(output, (value) => value / norm);
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      self.postMessage({
        id: data.id,
        vector: await encode(data.kind, data.value),
      });
    } catch (error) {
      self.postMessage({ id: data.id, error: error.message });
    } finally {
      self.postMessage({ progress: "" });
    }
  });
};
