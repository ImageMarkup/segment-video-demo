import measureBlur from "inspector-bokeh";
import { SelfieMulticlassVideoSegmenter } from "./segment";

function trackProcessor(track: MediaStreamVideoTrack) {
  return new MediaStreamTrackProcessor({ track });
}

interface VideoFrameCanvas {
  timestamp: number;
  canvas: OffscreenCanvas;
  context: OffscreenCanvasRenderingContext2D;
}

function frameToCanvasTransform() {
  return new TransformStream<VideoFrame, VideoFrameCanvas>({
    async transform(videoFrame, controller) {
      const canvas = new OffscreenCanvas(videoFrame.displayWidth, videoFrame.displayHeight);
      const context = canvas.getContext(
        "2d",
        {
          // Transparency is not actually used, and this may improve performance:
          // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#turn_off_transparency
          alpha: false,
          // Keep the canvas on the CPU, as we're going to maipulate it there anyway during compositing
          willReadFrequently: true,
        }
      )!;
      context.drawImage(videoFrame, 0, 0);
      videoFrame.close();

      controller.enqueue({
        timestamp: videoFrame.timestamp,
        canvas,
        context,
      });
    }
  });
}

function computeBlurTransform() {
  return new TransformStream<VideoFrameCanvas, VideoFrameCanvas>({
    async transform(frameCanvas, controller) {
      const imageData = frameCanvas.context.getImageData(0, 0, frameCanvas.canvas.width, frameCanvas.canvas.height);

      const blurStats = measureBlur(imageData);
      const blurValue = blurStats.avg_edge_width_perc * 100;
      (document.getElementById("blurSlider") as HTMLInputElement).value = blurValue.toFixed(0);
      (document.getElementById("blurText") as HTMLSpanElement).textContent = blurValue.toFixed(1);

      controller.enqueue(frameCanvas);
    }
  });
}

const segmenter = new SelfieMulticlassVideoSegmenter();
function segmentCanvasTransform() {
  return new TransformStream<VideoFrameCanvas, VideoFrameCanvas>({
    async transform(frameCanvas, controller) {
      const imageData = frameCanvas.context.getImageData(0, 0, frameCanvas.canvas.width, frameCanvas.canvas.height);

      // ImageSegmenter can take a VideoFrame too, but we need a rendered canvas to composite the mask onto anyway
      const segmentationResult = await segmenter.segment(imageData, frameCanvas.timestamp);
      blendCategoryMask(
        imageData,
        segmentationResult.categoryMask!.getAsUint8Array(),
        new Set([
          // SelfieMulticlassVideoSegmenter.Category.Background,
          // SelfieMulticlassVideoSegmenter.Category.Hair,
          SelfieMulticlassVideoSegmenter.Category.BodySkin,
          SelfieMulticlassVideoSegmenter.Category.FaceSkin,
          // SelfieMulticlassVideoSegmenter.Category.Clothes,
          // SelfieMulticlassVideoSegmenter.Category.Others,
        ]),
      );
      frameCanvas.context.putImageData(imageData, 0, 0);

      controller.enqueue(frameCanvas);
    }
  });
}
function blendCategoryMask(imageData: ImageData, categoryMask: Uint8Array, includeCategories: Set<SelfieMulticlassVideoSegmenter.Category>) {
  const rgbaArray = imageData.data;

  // "p" iterates over whole pixels, "v" iterates over individual sub-pixel values
  for (let p = 0, v = 0; p < categoryMask.length; ++p, v += 4) {
    const category = categoryMask[p] as SelfieMulticlassVideoSegmenter.Category;
    if(includeCategories.has(category)) {
      const categoryColor = SelfieMulticlassVideoSegmenter.Colormap[category];
      rgbaArray[v]     = (rgbaArray[v]     + categoryColor[0]) * 0.5;
      rgbaArray[v + 1] = (rgbaArray[v + 1] + categoryColor[1]) * 0.5;
      rgbaArray[v + 2] = (rgbaArray[v + 2] + categoryColor[2]) * 0.5;
      // Skip Alpha
    }
  }
}

function canvasToFrameTransform() {
  return new TransformStream<VideoFrameCanvas, VideoFrame>({
    async transform(frameCanvas, controller) {
      const newFrame = new VideoFrame(frameCanvas.canvas, {
        timestamp: frameCanvas.timestamp,
        alpha: 'discard',
      });
      controller.enqueue(newFrame);
    },
  });
}

function trackGenerator() {
  return new MediaStreamTrackGenerator({ kind: "video" });
}

let inputTrack: MediaStreamVideoTrack | null = null;
export async function buildPipeline(blur: boolean, segment: boolean): Promise<MediaStream> {
  if (inputTrack) {
    // Clean up any existing pipelines so they don't throw errors
    inputTrack.stop()
  }

  const inputMediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: {
        ideal: 'user'
      }
    }
  });

  inputTrack = inputMediaStream.getVideoTracks()[0];
  const outputTrack = trackGenerator();

  let readableStream = trackProcessor(inputTrack).readable
    .pipeThrough(frameToCanvasTransform());
  if (blur) {
    readableStream = readableStream
      .pipeThrough(computeBlurTransform());
  }
  if (segment) {
    readableStream = readableStream
      .pipeThrough(segmentCanvasTransform());
  }
  readableStream
    .pipeThrough(canvasToFrameTransform())
    .pipeTo(outputTrack.writable);

  return new MediaStream([outputTrack]);
}
