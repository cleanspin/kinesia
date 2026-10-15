import { clipSegment, crossedEdge } from "./geometry";

const box = { left: 0, top: 0, right: 100, bottom: 50 };

describe("clipSegment", () => {
  it("clips a segment that passes straight through", () => {
    expect(clipSegment(-50, 25, 150, 25, box)).toEqual({
      enter: 0.25,
      exit: 0.75,
      enterAxis: "x",
      exitAxis: "x",
    });
  });

  it("reports which axis was crossed on a diagonal", () => {
    // Enters the top at (60, 0), exits the right at (100, 33).
    const clip = clipSegment(0, -50, 150, 75, box);
    expect(clip?.enterAxis).toBe("y");
    expect(clip?.exitAxis).toBe("x");
    expect(clip?.enter).toBeCloseTo(0.4);
    expect(clip?.exit).toBeCloseTo(2 / 3);
  });

  it("misses when the slabs are crossed at different times", () => {
    // Exits the x-slab before reaching the y-slab, passing outside the corner.
    expect(clipSegment(80, -40, 140, 20, box)).toBeNull();
  });

  it("misses segments that stop short or start past the box", () => {
    expect(clipSegment(-50, 25, -10, 25, box)).toBeNull();
    expect(clipSegment(110, 25, 200, 25, box)).toBeNull();
  });

  it("handles axis-aligned segments outside a slab", () => {
    expect(clipSegment(-10, -10, -10, 100, box)).toBeNull();
    expect(clipSegment(-10, 60, 200, 60, box)).toBeNull();
  });

  it("treats a segment starting inside as entering at 0 with no axis", () => {
    expect(clipSegment(50, 25, 200, 25, box)).toEqual({
      enter: 0,
      exit: 1 / 3,
      enterAxis: null,
      exitAxis: "x",
    });
  });

  it("treats a zero-length segment as a point", () => {
    expect(clipSegment(10, 10, 10, 10, box)).toEqual({
      enter: 0,
      exit: 1,
      enterAxis: null,
      exitAxis: null,
    });
    expect(clipSegment(-1, 10, -1, 10, box)).toBeNull();
  });

  it("counts points on an edge as inside", () => {
    expect(clipSegment(0, 0, 0, 0, box)).not.toBeNull();
    expect(clipSegment(-10, 0, 0, 0, box)?.enter).toBe(1);
  });

  it("gives the same interval in either direction", () => {
    const forward = clipSegment(-50, 25, 150, 25, box);
    const backward = clipSegment(150, 25, -50, 25, box);
    expect(backward?.enter).toBeCloseTo(1 - (forward?.exit ?? 0));
    expect(backward?.exit).toBeCloseTo(1 - (forward?.enter ?? 0));
  });
});

describe("crossedEdge", () => {
  it("names the edge for each direction", () => {
    expect(crossedEdge("x", 1, true)).toBe("left");
    expect(crossedEdge("x", -1, true)).toBe("right");
    expect(crossedEdge("x", 1, false)).toBe("right");
    expect(crossedEdge("x", -1, false)).toBe("left");
    expect(crossedEdge("y", 1, true)).toBe("top");
    expect(crossedEdge("y", -1, true)).toBe("bottom");
    expect(crossedEdge("y", 1, false)).toBe("bottom");
    expect(crossedEdge("y", -1, false)).toBe("top");
  });
});
