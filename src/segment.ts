import {
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult
} from "@mediapipe/tasks-vision";

export class SelfieMulticlassVideoSegmenter {
  public ready: Promise<void>;
  private imageSegmenter?: ImageSegmenter;

  constructor() {
    this.ready = this.load();
  }

  private async load() {
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    this.imageSegmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  }

  public async segment(imageData: ImageData, timestamp: number): Promise<ImageSegmenterResult> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.imageSegmenter!.segmentForVideo(
        imageData,
        performance.now(),
        (result: ImageSegmenterResult) => {
          resolve(result);
        }
      );
    });
  }
}

export namespace SelfieMulticlassVideoSegmenter{
  // https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter#multiclass-model
  // TODO: Can also come from "this.imageSegmenter.getLabels()"
  export const enum Category {
    Background = 0,
    Hair = 1,
    BodySkin = 2,
    FaceSkin = 3,
    Clothes = 4,
    Others = 5,
  }

  type RGB = [number, number, number]
  export const Colormap: Record<Category, RGB> = {
    [Category.Background]: [206, 162, 98], // Grayish Yellow
    [Category.Hair]: [193, 0, 32], // Vivid Red
    [Category.BodySkin]: [255, 104, 0], // Vivid Orange
    [Category.FaceSkin]: [255, 197, 0], // Vivid Yellow
    [Category.Clothes]: [0, 161, 194], // Vivid Blue
    [Category.Others]: [0, 125, 52], // Vivid Green
  };

}
