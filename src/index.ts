import { buildPipeline } from './pipeline';
import Alpine from 'alpinejs';

Alpine.data('data', () => ({
  blur: false,
  segment: false,
  init() {
    Alpine.effect(async () => {
      await sync(this.blur, this.segment);
    });
  },
}));
Alpine.start();

async function sync(blur: boolean, segment: boolean) {
  const outputMediaStream = await buildPipeline(blur, segment);
  const videoElement = document.getElementById("video") as HTMLVideoElement;
  videoElement.srcObject = outputMediaStream;
}
