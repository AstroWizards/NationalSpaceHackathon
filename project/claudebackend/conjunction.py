"""
Conjunction Analysis Module

Analyzes close approaches between two satellites using TLE data.
"""

import numpy as np
from typing import Tuple, Optional
from datetime import datetime, timedelta
import math

# Physical constants
MU = 398600.4418  # km³/s²
RE = 6378.137  # km


class TLE:
    """Two-Line Element parser and basic propagator."""

    def __init__(self, name: str, line1: str, line2: str):
        self.name = name
        self.line1 = line1.strip()
        self.line2 = line2.strip()
        self._parse()

    def _parse(self):
        """Parse TLE lines to extract orbital elements."""
        try:
            # Line 1: extract inclination, RAAN, eccentricity, arg of perigee, mean anomaly, mean motion
            self.epoch = self._parse_epoch(self.line1[18:20], self.line1[20:32])
            self.inclination = float(self.line2[8:16])  # degrees
            self.raan = float(self.line2[17:25])  # degrees
            self.eccentricity = float("0." + self.line2[26:33])  # decimal point assumed
            self.arg_perigee = float(self.line2[34:42])  # degrees
            self.mean_anomaly = float(self.line2[43:51])  # degrees
            self.mean_motion = float(self.line2[52:63])  # revs per day

            # Convert to radians
            self.inclination_rad = math.radians(self.inclination)
            self.raan_rad = math.radians(self.raan)
            self.arg_perigee_rad = math.radians(self.arg_perigee)
            self.mean_anomaly_rad = math.radians(self.mean_anomaly)

            # Convert mean motion to semi-major axis
            # n = mean motion (rev/day) -> rad/s
            n = self.mean_motion * 2 * math.pi / 86400
            # a^3 = mu / n^2
            self.semi_major_axis = (MU / n**2)**(1/3)

            # Orbital period
            self.period = 2 * math.pi / n

        except (ValueError, IndexError) as e:
            raise ValueError(f"Invalid TLE format: {e}")

    def _parse_epoch(self, year_str: str, day_str: str) -> datetime:
        """Parse epoch from TLE."""
        year = int(year_str)
        day_of_year = float(day_str)

        if year >= 57:
            year += 1900
        else:
            year += 2000

        base = datetime(year, 1, 1)
        return base + timedelta(days=day_of_year - 1)

    def get_position(self, minutes_from_epoch: float) -> np.ndarray:
        """
        Get position at time offset from epoch (in minutes).
        Uses simple mean anomaly propagation (circular orbit approximation).
        """
        # Mean anomaly at time
        n = self.mean_motion * 2 * math.pi / 1440  # rad/min
        M = self.mean_anomaly_rad + n * minutes_from_epoch

        # Simplified: assume circular orbit in orbital plane
        # For more accuracy, would need full SGP4 or mean element to osculating conversion
        r = self.semi_major_axis  # Assume near-circular

        # Position in orbital plane (perifocal)
        x_orb = r * math.cos(M)
        y_orb = r * math.sin(M)

        # Transform to ECI using RAAN, inclination, arg of perigee
        O = self.raan_rad
        i = self.inclination_rad
        w = self.arg_perigee_rad

        # Rotation matrices
        cos_O, sin_O = math.cos(O), math.sin(O)
        cos_i, sin_i = math.cos(i), math.sin(i)
        cos_w, sin_w = math.cos(w), math.sin(w)

        # ECI position
        x = (cos_O * cos_w - sin_O * sin_w * cos_i) * x_orb + (-cos_O * sin_w - sin_O * cos_w * cos_i) * y_orb
        y = (sin_O * cos_w + cos_O * sin_w * cos_i) * x_orb + (-sin_O * sin_w + cos_O * cos_w * cos_i) * y_orb
        z = (sin_w * sin_i) * x_orb + (cos_w * sin_i) * y_orb

        return np.array([x, y, z])

    def get_velocity(self, minutes_from_epoch: float) -> np.ndarray:
        """Get velocity at time offset from epoch."""
        n = self.mean_motion * 2 * math.pi / 1440  # rad/min
        r = self.semi_major_axis

        # Velocity magnitude for circular orbit
        v_mag = math.sqrt(MU / r)

        # Simple: velocity perpendicular to radius
        M = self.mean_anomaly_rad + n * minutes_from_epoch

        # Tangent direction (simplified)
        x_orb = -r * math.sin(M) * n
        y_orb = r * math.cos(M) * n

        # Transform to ECI (same as position)
        O = self.raan_rad
        i = self.inclination_rad
        w = self.arg_perigee_rad

        cos_O, sin_O = math.cos(O), math.sin(O)
        cos_i, sin_i = math.cos(i), math.sin(i)
        cos_w, sin_w = math.cos(w), math.sin(w)

        vx = (cos_O * cos_w - sin_O * sin_w * cos_i) * x_orb + (-cos_O * sin_w - sin_O * cos_w * cos_i) * y_orb
        vy = (sin_O * cos_w + cos_O * sin_w * cos_i) * x_orb + (-sin_O * sin_w + cos_O * cos_w * cos_i) * y_orb
        vz = (sin_w * sin_i) * x_orb + (cos_w * sin_i) * y_orb

        return np.array([vx, vy, vz]) * (1/60)  # Convert to km/s


def find_closest_approach(
    tle1: TLE,
    tle2: TLE,
    search_duration_minutes: float = 1440,
    step_minutes: float = 1.0
) -> dict:
    """
    Find closest approach between two satellites.

    Args:
        tle1: First satellite TLE
        tle2: Second satellite TLE
        search_duration_minutes: How far ahead to search (default 1 day)
        step_minutes: Time step for search

    Returns:
        Dictionary with TCA, miss distance, relative velocity
    """
    min_distance = float('inf')
    tca_minutes = 0

    # Time offset from epoch of each satellite
    # Using epoch of first TLE as reference
    epoch1 = tle1.epoch
    epoch2 = tle2.epoch
    epoch_offset = (epoch2 - epoch1).total_seconds() / 60

    num_steps = int(search_duration_minutes / step_minutes)

    for step in range(num_steps):
        t1 = step
        t2 = step - epoch_offset  # Account for different epochs

        # Skip if time is negative
        if t2 < 0:
            continue

        try:
            pos1 = tle1.get_position(t1)
            pos2 = tle2.get_position(t2)
        except:
            continue

        # Distance
        dist = np.linalg.norm(pos1 - pos2)

        if dist < min_distance:
            min_distance = dist
            tca_minutes = t1

    if min_distance == float('inf'):
        return {"error": "Could not compute positions"}

    # Calculate relative velocity at TCA
    t1 = tca_minutes
    t2 = tca_minutes - epoch_offset

    try:
        vel1 = tle1.get_velocity(t1)
        vel2 = tle2.get_velocity(t2)
        rel_vel = np.linalg.norm(vel1 - vel2)
    except:
        rel_vel = 0

    # TCA as datetime
    tca_datetime = epoch1 + timedelta(minutes=tca_minutes)

    return {
        "tca": tca_datetime.isoformat(),
        "tca_offset_minutes": float(tca_minutes),
        "miss_distance_km": float(min_distance),
        "relative_velocity_km_s": float(rel_vel)
    }


def calculate_collision_probability(
    miss_distance_km: float,
    relative_velocity_km_s: float,
    combined_radius_km: float = 10.0,
    covariance_factor: float = 0.1
) -> float:
    """
    Calculate collision probability using simplified model.

    P ≈ (Rs / Rc)² where:
    - Rs = combined object radius
    - Rc = miss distance with uncertainty

    Args:
        miss_distance_km: Closest approach distance
        relative_velocity_km_s: Closing speed
        combined_radius_km: Sum of object radii (default 10m ~ 0.01km for large objects)
        covariance_factor: Uncertainty factor (default 10%)

    Returns:
        Probability of collision
    """
    if miss_distance_km <= 0:
        return 1.0

    # Uncertainty radius grows with time and velocity
    uncertainty = covariance_factor * miss_distance_km

    # Effective collision radius
    Rc = max(miss_distance_km, uncertainty)

    # Hard body radius (combined)
    Rs = combined_radius_km

    if Rc <= Rs:
        # Inside uncertainties - high probability
        return 1.0

    # Simple formula: area ratio
    # For more accuracy, use Foster/Magazine formula
    prob = (Rs / Rc)**2 if Rs < Rc else 1.0

    # Scale by velocity factor (faster = less time to react)
    # This is a simplification
    vel_factor = min(1.0, 10.0 / max(relative_velocity_km_s, 1.0))

    return min(1.0, prob * vel_factor)


def predict_debris(
    collision_velocity_km_s: float,
    mass_kg: float = 500.0
) -> dict:
    """
    Predict debris from collision.

    Uses empirical fragmentation models.

    Args:
        collision_velocity_km_s: Impact velocity
        mass_kg: Satellite mass (default 500kg)

    Returns:
        Dictionary with fragment count and spread
    """
    # Energy
    energy = 0.5 * mass_kg * (collision_velocity_km_s * 1000)**2  # Joules

    # Empirical formula: fragment count ~ energy^0.75 for catastrophic collision
    # With energy in MJ
    energy_mj = energy / 1e6

    if energy_mj < 1:
        # Non-catastrophic
        fragment_count = int(10 + energy_mj * 10)
    elif energy_mj < 60:
        # Catastrophic
        fragment_count = int(100 + 500 * (energy_mj / 60)**0.75)
    else:
        # Large collision
        fragment_count = int(500 + 2000 * (energy_mj / 60)**0.5)

    # Debris spread based on delta-v
    # Typical: fragments spread 1-10 km/s delta-v
    delta_v = min(collision_velocity_km_s, 5.0)
    spread_km = delta_v * 100  # Approximate spread time

    return {
        "fragment_count": fragment_count,
        "debris_spread_km": spread_km,
        "energy_mj": round(energy_mj, 2)
    }


def analyze_conjunction(
    sat1_name: str, tle1_line1: str, tle1_line2: str,
    sat2_name: str, tle2_line1: str, tle2_line2: str
) -> dict:
    """
    Full conjunction analysis between two satellites.

    Returns result matching PDF output format.
    """
    try:
        tle1 = TLE(sat1_name, tle1_line1, tle1_line2)
        tle2 = TLE(sat2_name, tle2_line1, tle2_line2)
    except ValueError as e:
        return {"error": str(e)}

    # Find closest approach
    ca = find_closest_approach(tle1, tle2)

    if "error" in ca:
        return ca

    # Collision probability
    prob = calculate_collision_probability(
        ca["miss_distance_km"],
        ca["relative_velocity_km_s"]
    )

    # Debris prediction
    debris = predict_debris(ca["relative_velocity_km_s"])

    # Get epoch offset between satellites
    epoch_offset = (tle2.epoch - tle1.epoch).total_seconds() / 60

    # Get positions at TCA
    t1 = float(ca.get("tca_offset_minutes", 0))
    t2 = t1 - epoch_offset

    pos1 = tle1.get_position(t1)
    pos2 = tle2.get_position(t2)

    # Convert to lat/lon
    def eci_to_latlon(pos):
        x, y, z = float(pos[0]), float(pos[1]), float(pos[2])
        r = math.sqrt(x**2 + y**2 + z**2)
        lat = math.asin(z / r) * 180 / math.pi
        lon = math.atan2(y, x) * 180 / math.pi
        return {"lat": round(lat, 2), "lon": round(lon, 2)}

    pos1_ll = eci_to_latlon(pos1)
    pos2_ll = eci_to_latlon(pos2)

    return {
        "satellite1": sat1_name,
        "satellite2": sat2_name,
        "tca": ca["tca"],
        "miss_distance_km": round(ca["miss_distance_km"], 4),
        "collision_probability": round(prob, 6),
        "relative_velocity_km_s": round(ca["relative_velocity_km_s"], 4),
        "debris_prediction": {
            "fragment_count": debris["fragment_count"],
            "debris_spread_km": round(debris["debris_spread_km"], 2)
        },
        "positions": {
            "satellite1": pos1_ll,
            "satellite2": pos2_ll
        }
    }