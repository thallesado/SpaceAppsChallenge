from pydantic import BaseModel, Field, model_validator

from .models import ScenarioResult, Scenario


class RankingWeights(BaseModel):
    sun: float = Field(default=0.35, ge=0, le=1, description="Weight for sunlight fraction")
    earth: float = Field(default=0.25, ge=0, le=1, description="Weight for Earth direct visibility")
    concurrent: float = Field(default=0.20, ge=0, le=1, description="Weight for concurrent Sun & Earth visibility")
    darkness_penalty: float = Field(default=0.10, ge=0, le=1, description="Weight for minimizing longest darkness window")
    blackout_penalty: float = Field(default=0.10, ge=0, le=1, description="Weight for minimizing communication blackout")


class ScoredSite(BaseModel):
    rank: int
    label: str
    latitude_deg: float
    longitude_deg: float
    score: float = Field(ge=0, le=100)
    sunlit_percent: float
    earth_visible_percent: float
    concurrent_percent: float
    longest_darkness_hours: float
    longest_blackout_hours: float
    constraints_met: bool
    highlights: list[str]
    tradeoffs: list[str]
    result: ScenarioResult


class RankingResponse(BaseModel):
    best_site: str | None
    executive_summary: str
    weights_used: RankingWeights
    ranked_sites: list[ScoredSite]


class RankRequest(BaseModel):
    scenarios: list[Scenario] = Field(min_length=2, max_length=10)
    weights: RankingWeights = Field(default_factory=RankingWeights)

    @model_validator(mode='after')
    def matching_requirements(self):
        first = self.scenarios[0]
        for scenario in self.scenarios[1:]:
            if (scenario.end_utc - scenario.start_utc, scenario.constraints, scenario.step_minutes, scenario.use_dem_horizon) != (first.end_utc - first.start_utc, first.constraints, first.step_minutes, first.use_dem_horizon):
                raise ValueError('Rank with equal duration, requirements, sampling and horizon model')
        return self


def rank_scenarios(results: list[ScenarioResult], weights: RankingWeights) -> RankingResponse:
    if not results:
        raise ValueError("Cannot rank empty scenario results")

    scored: list[dict] = []

    # Find maximum duration in hours to normalize blackout/darkness
    for res in results:
        m = res.metrics
        sc = res.scenario
        total_hours = max(1.0, (sc.end_utc - sc.start_utc).total_seconds() / 3600.0)

        # Normalize metrics to [0, 1]
        sun_score = m.sunlit_fraction
        earth_score = m.earth_visible_fraction
        conc_score = m.concurrent_fraction

        darkness_penalty = max(0.0, 1.0 - (m.longest_darkness_hours / total_hours))
        blackout_penalty = max(0.0, 1.0 - (m.longest_earth_blackout_hours / total_hours))

        # Weight calculation
        w_sum = weights.sun + weights.earth + weights.concurrent + weights.darkness_penalty + weights.blackout_penalty
        w_sum = w_sum if w_sum > 0 else 1.0

        raw_score = (
            weights.sun * sun_score
            + weights.earth * earth_score
            + weights.concurrent * conc_score
            + weights.darkness_penalty * darkness_penalty
            + weights.blackout_penalty * blackout_penalty
        ) / w_sum

        # Penalty if user-specified constraints were violated
        final_score = raw_score * 100.0
        if not m.constraints_met:
            final_score *= 0.85

        # Highlights and Tradeoffs
        highlights = []
        tradeoffs = []

        if m.sunlit_fraction >= 0.70:
            highlights.append(f"Alta disponibilidad solar ({round(m.sunlit_fraction * 100, 1)}%)")
        elif m.sunlit_fraction < 0.40:
            tradeoffs.append(f"Baja iluminación acumulada ({round(m.sunlit_fraction * 100, 1)}%)")

        if m.earth_visible_fraction >= 0.70:
            highlights.append(f"Excelente cobertura de comunicaciones DSN ({round(m.earth_visible_fraction * 100, 1)}%)")
        elif m.earth_visible_fraction < 0.40:
            tradeoffs.append(f"Ventanas de comunicación restringidas ({round(m.earth_visible_fraction * 100, 1)}%)")

        if m.longest_darkness_hours <= 12.0:
            highlights.append(f"Noche máxima muy corta ({m.longest_darkness_hours}h)")
        elif m.longest_darkness_hours > 48.0:
            tradeoffs.append(f"Noche prolongada ({m.longest_darkness_hours}h) que exige alta capacidad de batería")

        if m.longest_earth_blackout_hours <= 6.0:
            highlights.append(f"Apagón de radio mínimo ({m.longest_earth_blackout_hours}h)")
        elif m.longest_earth_blackout_hours > 24.0:
            tradeoffs.append(f"Apagón de enlace prolongado ({m.longest_earth_blackout_hours}h)")

        if not m.constraints_met:
            tradeoffs.append("No cumple con todas las restricciones del escenario")

        label = sc.site.label or f"Lat {sc.site.latitude_deg:.2f}, Lon {sc.site.longitude_deg:.2f}"

        scored.append({
            "label": label,
            "site": sc.site,
            "score": round(final_score, 1),
            "sunlit_percent": round(m.sunlit_fraction * 100, 1),
            "earth_visible_percent": round(m.earth_visible_fraction * 100, 1),
            "concurrent_percent": round(m.concurrent_fraction * 100, 1),
            "longest_darkness_hours": round(m.longest_darkness_hours, 1),
            "longest_blackout_hours": round(m.longest_earth_blackout_hours, 1),
            "constraints_met": m.constraints_met,
            "highlights": highlights,
            "tradeoffs": tradeoffs,
            "result": res,
        })

    # Sort descending by score
    scored.sort(key=lambda x: (x["constraints_met"], x["score"]), reverse=True)

    ranked_sites: list[ScoredSite] = []
    for rank_idx, item in enumerate(scored, start=1):
        ranked_sites.append(
            ScoredSite(
                rank=rank_idx,
                label=item["label"],
                latitude_deg=item["site"].latitude_deg,
                longitude_deg=item["site"].longitude_deg,
                score=item["score"],
                sunlit_percent=item["sunlit_percent"],
                earth_visible_percent=item["earth_visible_percent"],
                concurrent_percent=item["concurrent_percent"],
                longest_darkness_hours=item["longest_darkness_hours"],
                longest_blackout_hours=item["longest_blackout_hours"],
                constraints_met=item["constraints_met"],
                highlights=item["highlights"],
                tradeoffs=item["tradeoffs"],
                result=item["result"],
            )
        )

    best = ranked_sites[0]
    any_met = any(row.constraints_met for row in ranked_sites)
    exec_summary = (
        f"El sitio recomendado es '{best.label}' con una puntuación de {best.score}/100. "
        f"Ofrece {best.sunlit_percent}% de luz solar y {best.earth_visible_percent}% de visibilidad directa de la Tierra, "
        f"con una oscuridad máxima continua de {best.longest_darkness_hours}h."
    )

    return RankingResponse(
        best_site=best.label if any_met else None,
        executive_summary=exec_summary if any_met else 'Ninguna alternativa cumple las restricciones. Revisa las condiciones o compara otros sitios y fechas.',
        weights_used=weights,
        ranked_sites=ranked_sites,
    )
