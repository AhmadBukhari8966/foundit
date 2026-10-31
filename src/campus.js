import buildings from "../campus/buildings.json" with { type: "json" };
export { buildings };
export const campusBuildings = [...buildings].sort((a, b) =>
  a.name.localeCompare(b.name),
);
export function getBuilding(name) {
  return buildings.find((building) => building.name === name) || null;
}
export function walkingDirections(name) {
  if (!getBuilding(name)) return null;
  const params = new URLSearchParams({
    api: "1",
    destination: `${name}, Truman State University, Kirksville, Missouri`,
    travelmode: "walking",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
