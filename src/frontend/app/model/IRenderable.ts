export interface IRenderable {
  getDimension(): Dimension;
}

export interface Dimension {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const DimensionUtils = {
  toString: (dim: Dimension): Keyframe => {
    return {
      top: (dim.top || 0) + 'px',
      left: (dim.left || 0) + 'px',
      width: (dim.width || 0) + 'px',
      height: (dim.height || 0) + 'px',
    };
  },
};
