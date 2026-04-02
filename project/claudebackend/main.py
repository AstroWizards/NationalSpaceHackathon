from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from earth_shadow import EarthShadow, predict_shadow_times_at_position
from conjunction import analyze_conjunction
import time

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Default shadow calculator with Sun in +X direction
shadow_calc = EarthShadow()


class PositionInput(BaseModel):
    position: List[float]
    velocity: Optional[List[float]] = None


class SatelliteTLE(BaseModel):
    name: str
    line1: str
    line2: str


class ConjunctionRequest(BaseModel):
    satellite1: SatelliteTLE
    satellite2: SatelliteTLE


@app.post("/api/conjunction/analyze")
def conjunction_analyze(data: ConjunctionRequest):
    """
    Analyze conjunction between two satellites from TLE data.

    Returns TCA, miss distance, collision probability, and debris prediction.
    """
    result = analyze_conjunction(
        data.satellite1.name, data.satellite1.line1, data.satellite1.line2,
        data.satellite2.name, data.satellite2.line1, data.satellite2.line2
    )
    return result


class ShadowResponse(BaseModel):
    in_shadow: bool
    shadow_type: str  # "umbra", "penumbra", "sunlight"
    eclipse_factor: float  # 0.0 = full shadow, 1.0 = full sun


class ShadowPredictionInput(BaseModel):
    position: List[float]
    velocity: List[float]
    epoch: float = 0.0
    num_orbits: int = 1


@app.post("/api/shadow/check")
def check_shadow(data: PositionInput) -> ShadowResponse:
    """
    Check if a satellite position is in Earth's shadow right now.
    """
    pos = np.array(data.position)

    shadow_type = shadow_calc.get_shadow_type(pos)
    in_shadow = shadow_type == "umbra"
    eclipse_factor = shadow_calc.get_eclipse_factor(pos)

    return ShadowResponse(
        in_shadow=in_shadow,
        shadow_type=shadow_type,
        eclipse_factor=eclipse_factor
    )


@app.post("/api/shadow/predict")
def predict_shadow(data: ShadowPredictionInput):
    """
    Predict shadow entry/exit times over multiple orbits.

    Returns:
        - orbital_period_seconds: Time for one orbit
        - shadow_events: List of {entry, exit, duration} times
        - total_shadow_time: Total time in shadow per orbit
    """
    pos = np.array(data.position)
    vel = np.array(data.velocity)

    result = shadow_calc.predict_shadow_events(
        initial_position=pos,
        initial_velocity=vel,
        start_time=data.epoch,
        num_orbits=data.num_orbits
    )

    return result


@app.post("/api/shadow/eclipse-duration")
def get_eclipse_duration(
    perigee_km: float,
    apogee_km: float,
    sun_inclination: float = 0.0
):
    """
    Estimate eclipse duration for an orbit.

    Args:
        perigee_km: Perigee radius in km
        apogee_km: Apogee radius in km
        sun_inclination: Angle between orbit normal and Sun direction (radians)
    """
    from earth_shadow import calculate_shadow_duration

    shadow_dur, sun_dur = calculate_shadow_duration(perigee_km, apogee_km, sun_inclination)

    return {
        "shadow_duration_seconds": shadow_dur,
        "sunlight_duration_seconds": sun_dur,
        "orbital_period_seconds": shadow_dur + sun_dur
    }
