import type { PointerSample } from "../pointer/tracker";
import type { Rect } from "../types";
import { type ContactQuery, findContacts } from "./contacts";

const target: Rect = { x: 100, y: 0, width: 50, height: 50 };

function sample(x: number, y: number, time: number): PointerSample {
  return { x, y, time };
}

function query(overrides: Partial<ContactQuery> & Pick<ContactQuery, "path">): ContactQuery {
  return {
    from: target,
    to: target,
    fromTime: 0,
    toTime: 16,
    padding: 0,
    inside: false,
    ...overrides,
  };
}

describe("findContacts", () => {
  it("reports an enter and a leave for a target the pointer passed over within one frame", () => {
    const { contacts, inside } = findContacts(
      query({ path: [sample(0, 25, 0), sample(300, 25, 15)] }),
    );
    expect(inside).toBe(false);
    expect(contacts).toHaveLength(2);
    const [enter, leave] = contacts;
    expect(enter).toMatchObject({ type: "enter", edge: "left", point: { x: 100, y: 25 } });
    expect(enter?.local).toEqual({ x: 0, y: 25 });
    expect(enter?.time).toBeCloseTo(5);
    expect(leave).toMatchObject({ type: "leave", edge: "right", point: { x: 150, y: 25 } });
    expect(leave?.time).toBeCloseTo(7.5);
  });

  it("reports only an enter when the path ends inside", () => {
    const { contacts, inside } = findContacts(
      query({ path: [sample(125, 100, 0), sample(125, 25, 16)] }),
    );
    expect(inside).toBe(true);
    expect(contacts.map((c) => [c.type, c.edge])).toEqual([["enter", "bottom"]]);
  });

  it("reports only a leave when the path starts inside", () => {
    const { contacts, inside } = findContacts(
      query({ inside: true, path: [sample(125, 25, 0), sample(125, -100, 16)] }),
    );
    expect(inside).toBe(false);
    expect(contacts.map((c) => [c.type, c.edge])).toEqual([["leave", "top"]]);
  });

  it("ignores a brief exit when the pointer starts and ends inside", () => {
    const { contacts, inside } = findContacts(
      query({
        inside: true,
        path: [sample(110, 25, 0), sample(200, 25, 8), sample(120, 25, 16)],
      }),
    );
    expect(inside).toBe(true);
    expect(contacts).toEqual([]);
  });

  it("follows the sampled path rather than a straight line", () => {
    // A straight line would cross the target; the sampled path curves over it.
    const { contacts } = findContacts(
      query({ path: [sample(50, 25, 0), sample(125, -50, 8), sample(200, 25, 16)] }),
    );
    expect(contacts).toEqual([]);
  });

  it("detects a target scrolling under a still pointer", () => {
    const { contacts, inside } = findContacts(
      query({
        path: [sample(125, 100, 0), sample(125, 100, 16)],
        from: { ...target, y: 150 },
        to: { ...target, y: 60 },
      }),
    );
    expect(inside).toBe(true);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ type: "enter", edge: "top", point: { x: 125, y: 100 } });
    expect(contacts[0]?.local.y).toBeCloseTo(0);
    expect(contacts[0]?.time).toBeCloseTo((50 / 90) * 16);
  });

  it("reports no edge when the target appears under the pointer", () => {
    const { contacts } = findContacts(query({ path: [sample(125, 25, 16)] }));
    expect(contacts).toMatchObject([{ type: "enter", edge: null }]);
  });

  it("reports the edge a moving target leaves the pointer through", () => {
    const { contacts } = findContacts(
      query({
        inside: true,
        path: [sample(125, 25, 0), sample(125, 25, 16)],
        to: { ...target, x: 600 },
      }),
    );
    expect(contacts).toMatchObject([{ type: "leave", edge: "left" }]);
  });

  it("reports no edge when the target jumped away without being tracked", () => {
    const moved = { ...target, x: 600 };
    const { contacts, inside } = findContacts(
      query({
        inside: true,
        path: [sample(125, 25, 0), sample(125, 25, 16)],
        from: moved,
        to: moved,
      }),
    );
    expect(inside).toBe(false);
    expect(contacts).toMatchObject([{ type: "leave", edge: null }]);
  });

  it("grows the hit area by the padding", () => {
    const path = [sample(95, -50, 0), sample(95, 100, 16)];
    expect(findContacts(query({ path })).contacts).toEqual([]);
    const { contacts } = findContacts(query({ path, padding: 10 }));
    expect(contacts.map((c) => [c.type, c.edge])).toEqual([
      ["enter", "top"],
      ["leave", "bottom"],
    ]);
    expect(contacts[0]?.local).toEqual({ x: -5, y: -10 });
  });
});
