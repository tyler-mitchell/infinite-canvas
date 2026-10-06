import { perspective } from "@thi.ng/matrices/perspective";
import { d } from "typegpu";

export function perspectiveMatrix({
  fieldOfView,
  near,
  far,
}: {
  fieldOfView: number;
  near: number;
  far: number;
}) {
  const matrix = d.mat4x4f();
  perspective(matrix, (fieldOfView * 180) / Math.PI, 1, near, far);
  matrix.columns[2].z = (matrix.columns[2].z - 1) / 2;
  matrix.columns[3].z /= 2;
  return matrix;
}
