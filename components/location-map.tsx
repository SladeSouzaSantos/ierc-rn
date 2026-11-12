"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { IERC_MAPS_LINK, IERC_MAPS_EMBED } from "@/lib/location";

/**
 * A permanent public location, provided by IERC-RN and corroborated by
 * municipal records. The external Maps share URL was supplied by the team.
 * Google Maps does not receive a visitor's request until they opt in to
 * loading the iframe; the external link works without JavaScript.
 */
export function LocationMap() {
  const [showMap, setShowMap] = useState(false);
  return (
    <section className="location-map" aria-labelledby="location-map-title">
      <div className="location-map-details">
        <MapPin size={28} aria-hidden="true" />
        <h2 id="location-map-title">Como chegar ao IERC-RN</h2>
        <p>Rua Fonseca e Silva, 1113 — Alecrim, Natal/RN.</p>
        <a className="inline-link" href={IERC_MAPS_LINK}
           target="_blank" rel="noopener noreferrer">
          Abrir localização no Google Maps
          <ExternalLink size={17} aria-hidden="true" />
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
        <p className="location-map-privacy">
          O mapa interativo é fornecido pelo Google. Ele só será
          carregado se você selecionar a opção abaixo.
        </p>
      </div>
      <div className="location-map-viewer">
        {showMap ? (
          <iframe
            title="Mapa interativo: IERC-RN, Rua Fonseca e Silva, 1113, Natal"
            src={IERC_MAPS_EMBED}
            loading="lazy"
            referrerPolicy="no-referrer"
            allowFullScreen
          />
        ) : (
          <div className="location-map-placeholder">
            <MapPin size={36} aria-hidden="true" />
            <p>Visualize a localização do Instituto no mapa.</p>
            <button type="button" className="button button-dark"
              onClick={() => setShowMap(true)}>
              Carregar mapa interativo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
