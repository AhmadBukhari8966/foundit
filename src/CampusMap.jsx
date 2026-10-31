import React, { useEffect, useRef, useState, useId } from "react";
import {
  MapPin,
  Minus,
  Plus,
  Navigation,
  ArrowRight,
  FileDown,
} from "lucide-react";
import {
  buildings,
  campusBuildings,
  getBuilding,
  walkingDirections,
} from "./campus.js";
const base = import.meta.env.BASE_URL;
export function CampusMap({
  selected = "",
  onSelect,
  onBrowse,
  counts = {},
  showSelector = true,
  readOnly = false,
}) {
  const [zoom, setZoom] = useState(1);
  const frame = useRef(null);
  const stage = useRef(null);
  const id = useId();
  const building = getBuilding(selected);
  useEffect(() => {
    if (!building || !frame.current || !stage.current) return;
    const box = frame.current;
    box.scrollTo({
      left: Math.max(
        0,
        (stage.current.clientWidth * building.x) / 100 - box.clientWidth / 2,
      ),
      top: Math.max(
        0,
        (stage.current.clientHeight * building.y) / 100 - box.clientHeight / 2,
      ),
      behavior: "smooth",
    });
  }, [selected, zoom, building]);
  if (readOnly && !building)
    return (
      <div className="unmapped-location">
        <MapPin size={19} />
        <p>
          This listing has no marked Truman building. Check the finder’s
          location and pickup notes.
        </p>
      </div>
    );
  return (
    <section
      className="campus-map"
      aria-label={
        readOnly ? `Campus location: ${selected}` : "Truman campus building map"
      }
    >
      {showSelector && !readOnly && (
        <label className="map-select" htmlFor={id}>
          Choose a campus building
          <select
            id={id}
            value={building ? selected : ""}
            onChange={(e) => onSelect?.(e.target.value)}
          >
            <option value="">Select a building…</option>
            {campusBuildings.map((b) => (
              <option key={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="map-toolbar">
        <span>
          <MapPin size={15} />
          {readOnly ? "Reported found location" : "Select a building marker"}
        </span>
        <div>
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom campus map out"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          >
            <Minus size={16} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Zoom campus map in"
            disabled={zoom >= 3}
            onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div
        className="map-viewport"
        ref={frame}
        tabIndex={0}
        aria-label="Scrollable campus map. Use the building dropdown or markers to select a location."
      >
        <div
          className="map-stage"
          ref={stage}
          style={{ width: `${zoom * 100}%` }}
        >
          <img
            src={`${base}maps/truman-campus-2026.webp`}
            alt="Truman State University campus map, 2026. North is at the top."
            draggable="false"
            onLoad={() => {
              if (building && frame.current && stage.current)
                frame.current.scrollTop = Math.max(
                  0,
                  (stage.current.clientHeight * building.y) / 100 -
                    frame.current.clientHeight / 2,
                );
            }}
          />
          {buildings
            .filter((b) => !readOnly || b.name === selected)
            .map((b) => (
              <button
                key={b.id}
                type="button"
                className={`building-pin ${b.name === selected ? "selected" : ""} ${counts[b.name] ? "has-items" : ""}`}
                style={{ left: `${b.x}%`, top: `${b.y}%` }}
                aria-label={`${b.name}${counts[b.name] ? `, ${counts[b.name]} matching items` : ""}`}
                aria-pressed={b.name === selected}
                title={b.name}
                onClick={() => onSelect?.(b.name)}
              >
                <MapPin
                  size={b.name === selected ? 24 : 17}
                  fill="currentColor"
                />
                <span className="pin-label">{b.name}</span>
                {counts[b.name] > 0 && (
                  <span className="pin-count">{counts[b.name]}</span>
                )}
              </button>
            ))}
        </div>
      </div>
      <div className="map-selection" aria-live="polite">
        <span className="map-building-icon">
          <MapPin size={20} />
        </span>
        <div>
          <strong>{building ? building.name : "No building selected"}</strong>
          <span>
            {building
              ? "Building-level marker on the supplied campus map."
              : "Choose a marker or use the building list."}
          </span>
        </div>
      </div>
      {building && (readOnly || onBrowse) && (
        <div className="map-actions">
          {onBrowse && (
            <button
              className="button primary"
              type="button"
              onClick={() => onBrowse(building.name)}
            >
              Show items here <ArrowRight size={15} />
            </button>
          )}
          <a
            className="button secondary"
            href={walkingDirections(building.name)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={15} />
            Walking directions
          </a>
        </div>
      )}
      {readOnly && (
        <p className="map-note">
          Directions open Google Maps for this building. Check pickup notes
          first; the item may have been moved. The marker does not identify a
          room or entrance.
        </p>
      )}
      <a
        className="map-source"
        href={`${base}maps/truman-campus-2026.pdf`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <FileDown size={13} />
        View original Truman campus map (2026)
      </a>
    </section>
  );
}
