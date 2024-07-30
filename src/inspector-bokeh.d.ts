declare module 'inspector-bokeh' {
  export interface BlurStats {
    width: number;
    height: number;
    num_edges: number;
    avg_edge_width: number;
    avg_edge_width_perc: number;
  };

  export default function measureBlur(imageData: ImageData): BlurStats;
}
