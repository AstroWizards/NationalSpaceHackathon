"""
Earth Shadow (Eclipse) Calculation Module

Determines when a satellite is in Earth's shadow (umbra) or partial shadow (penumbra).
Useful for power generation and thermal analysis.
"""

import numpy as np
from typing import Tuple

# Physical constants
MU = 398600.4418  # km³/s² - Earth gravitational parameter
RE = 6378.137  # km - Earth equatorial radius
AU = 149597870.7  # km - Astronomical Unit (Sun distance)
SUN_RADIUS = 696340  # km - Sun radius


class EarthShadow:
    """Calculate satellite eclipse conditions."""

    def __init__(self, sun_direction: np.ndarray = None):
        """
        Initialize shadow calculator.

        Args:
            sun_direction: Unit vector pointing to Sun (default: +X direction)
        """
        # Default Sun direction: pointing from Sun to Earth
        # In inertial frame, Sun direction is typically along X axis
        self.sun_direction = sun_direction if sun_direction is not None else np.array([1.0, 0.0, 0.0])
        self.sun_direction = self.sun_direction / np.linalg.norm(self.sun_direction)

    def is_in_shadow(self, satellite_position: np.ndarray) -> bool:
        """
        Check if satellite is in Earth's umbra (complete shadow).

        Args:
            satellite_position: Position vector in km [x, y, z]

        Returns:
            True if in complete shadow
        """
        shadow_type = self.get_shadow_type(satellite_position)
        return shadow_type == "umbra"

    def get_shadow_type(self, satellite_position: np.ndarray) -> str:
        """
        Determine shadow type: umbra, penumbra, or sunlight.

        Uses cone geometry to determine if satellite is in shadow region.

        Args:
            satellite_position: Position vector in km [x, y, z]

        Returns:
            "umbra", "penumbra", or "sunlight"
        """
        r = np.linalg.norm(satellite_position)

        if r <= RE:
            return "sunlight"  # Inside Earth

        # Project satellite position onto Sun direction
        # dot > 0: satellite is on day side (same direction as sun from Earth)
        # dot < 0: satellite is on night side (opposite direction from sun)
        sun_proj = np.dot(satellite_position, self.sun_direction)

        # If on day side (sun_proj > 0), always in sunlight
        # (Satellite is closer to Sun than Earth)
        if sun_proj > 0:
            return "sunlight"

        # On night side - check if in shadow
        # Calculate apparent angular radius of Earth and Sun
        # From satellite's perspective
        earth_apparent = np.arcsin(RE / r)
        sun_apparent = np.arcsin(SUN_RADIUS / AU)

        # Earth-Sun separation angle from satellite's view
        # Direction from satellite to Sun is -sun_direction (towards +X = away from Sun? No)
        # Direction to Sun: Sun is at infinity along +sun_direction
        # So direction from satellite to Sun IS sun_direction
        # Direction from satellite to Earth center: -position/r

        sat_to_sun = self.sun_direction  # Direction towards Sun from satellite
        sat_to_earth = -satellite_position / r  # Direction towards Earth center

        sun_earth_separation = np.arccos(np.clip(np.dot(sat_to_sun, sat_to_earth), -1.0, 1.0))

        # Umbra: satellite sees Sun completely blocked by Earth
        # Earth blocks entire Sun when Earth apparent > Sun apparent + separation
        if sun_earth_separation + sun_apparent <= earth_apparent:
            return "umbra"
        elif sun_earth_separation < earth_apparent + sun_apparent:
            return "penumbra"
        else:
            return "sunlight"

    def get_eclipse_factor(self, satellite_position: np.ndarray) -> float:
        """
        Get the fraction of Sun visible (1.0 = full sun, 0.0 = full eclipse).

        Args:
            satellite_position: Position vector in km [x, y, z]

        Returns:
            Eclipse factor from 0.0 (full shadow) to 1.0 (full sun)
        """
        r = np.linalg.norm(satellite_position)

        if r <= RE:
            return 1.0

        sun_proj = np.dot(satellite_position, self.sun_direction)

        # Day side - full sun
        if sun_proj > 0:
            return 1.0

        # Angular calculations
        earth_apparent = np.arcsin(RE / r)
        sun_apparent = np.arcsin(SUN_RADIUS / AU)

        sat_to_sun = self.sun_direction
        sat_to_earth = -satellite_position / r

        sun_earth_separation = np.arccos(np.clip(np.dot(sat_to_sun, sat_to_earth), -1.0, 1.0))

        # Fully in umbra
        if sun_earth_separation + sun_apparent <= earth_apparent:
            return 0.0

        # Fully in sunlight (but we're on night side, so should be penumbra)
        if sun_earth_separation >= earth_apparent + sun_apparent:
            return 1.0

        # In penumbra - calculate fraction
        # Using linear approximation
        d = sun_earth_separation
        factor = (d + sun_apparent - earth_apparent) / (2 * sun_apparent)
        return np.clip(factor, 0.0, 1.0)

    def get_shadow_entry_exit(
        self,
        satellite_position: np.ndarray,
        velocity: np.ndarray,
        dt: float = 1.0,
        duration: float = 86400.0
    ) -> Tuple[float, float]:
        """
        Find shadow entry and exit times for a satellite trajectory.

        Args:
            satellite_position: Initial position [x, y, z] in km
            velocity: Velocity vector [vx, vy, vz] in km/s
            dt: Time step in seconds
            duration: Duration to search in seconds

        Returns:
            (entry_time, exit_time) in seconds from start, or (-1, -1) if not in shadow
        """
        entry_time = -1.0
        exit_time = -1.0
        in_shadow = self.is_in_shadow(satellite_position)

        pos = np.array(satellite_position, dtype=float)
        vel = np.array(velocity, dtype=float)

        t = 0.0
        while t < duration:
            # Simple integration (not physically accurate, just for search)
            pos = pos + vel * dt

            was_in_shadow = in_shadow
            in_shadow = self.is_in_shadow(pos)

            if in_shadow and not was_in_shadow:
                entry_time = t
            elif was_in_shadow and not in_shadow:
                exit_time = t
                break

            t += dt

        return entry_time, exit_time

    def predict_shadow_events(
        self,
        initial_position: np.ndarray,
        initial_velocity: np.ndarray,
        start_time: float = 0.0,
        num_orbits: int = 1,
        dt: float = 30.0
    ) -> dict:
        """
        Predict shadow entry and exit times for multiple orbits.

        Uses circular orbital propagation for efficiency.

        Args:
            initial_position: Initial position [x, y, z] in km
            initial_velocity: Initial velocity [vx, vy, vz] in km/s
            start_time: Start time in seconds (Unix timestamp)
            num_orbits: Number of orbits to predict
            dt: Time step in seconds

        Returns:
            Dictionary with shadow events
        """
        r = np.linalg.norm(initial_position)

        if r < RE:
            return {"error": "Position inside Earth"}

        # Calculate orbital period
        v_mag = np.linalg.norm(initial_velocity)
        if v_mag > 0:
            omega = v_mag / r  # rad/s for circular orbit
        else:
            omega = np.sqrt(MU / r**3)  # fallback

        period = 2 * np.pi / omega
        total_duration = period * num_orbits
        num_steps = int(total_duration / dt) + 1

        # Track shadow
        t = start_time
        current_pos = np.array(initial_position, dtype=float)

        events = []
        in_shadow = self.is_in_shadow(current_pos)
        shadow_start = None

        for step in range(num_steps):
            was_in_shadow = in_shadow
            in_shadow = self.is_in_shadow(current_pos)

            if in_shadow and not was_in_shadow:
                shadow_start = t
            elif was_in_shadow and not in_shadow and shadow_start is not None:
                events.append({
                    "entry": round(shadow_start),
                    "exit": round(t),
                    "duration": round(t - shadow_start)
                })
                shadow_start = None

            # Simple circular orbit - rotate by omega*dt
            d_angle = omega * dt
            cos_a = np.cos(d_angle)
            sin_a = np.sin(d_angle)
            current_pos = np.array([
                current_pos[0] * cos_a - current_pos[1] * sin_a,
                current_pos[0] * sin_a + current_pos[1] * cos_a,
                current_pos[2]
            ])

            t += dt

        # Close event if still in shadow
        if shadow_start is not None:
            events.append({
                "entry": round(shadow_start),
                "exit": round(t),
                "duration": round(t - shadow_start)
            })

        return {
            "orbital_period_seconds": round(period),
            "shadow_events": events,
            "total_shadow_time": sum(e["duration"] for e in events)
        }


def predict_shadow_times_at_position(
    position: np.ndarray,
    epoch: float,
    sun_direction: np.ndarray = None
) -> dict:
    """
    Predict when a satellite at a given position enters/exits shadow.

    Args:
        position: Satellite position [x, y, z] in km
        epoch: Start time in seconds (Unix timestamp)
        sun_direction: Unit vector to Sun

    Returns:
        Dictionary with timing info
    """
    shadow = EarthShadow(sun_direction)

    in_shadow = shadow.is_in_shadow(position)
    shadow_type = shadow.get_shadow_type(position)
    eclipse_factor = shadow.get_eclipse_factor(position)

    return {
        "position": position.tolist(),
        "epoch": epoch,
        "in_shadow": in_shadow,
        "shadow_type": shadow_type,
        "eclipse_factor": eclipse_factor,
        "next_transition": "entry" if in_shadow else "exit"
    }


def calculate_shadow_duration(
    r_p: float,  # perigee radius
    r_a: float,  # apogee radius
    sun_inclination: float = 0.0  # angle between orbit normal and sun direction
) -> Tuple[float, float]:
    """
    Estimate shadow duration for an elliptical orbit.

    Args:
        r_p: Perigee radius in km
        r_a: Apogee radius in km
        sun_inclination: Orbit inclination relative to Sun direction (radians)

    Returns:
        (shadow_duration, sunlight_duration) in seconds per orbit
    """
    a = (r_p + r_a) / 2  # Semi-major axis
    e = (r_a - r_p) / (r_a + r_p)  # Eccentricity
    period = 2 * np.pi * np.sqrt(a**3 / MU)  # Orbital period

    # Approximate shadow fraction based on orbit geometry
    # This is a simplified model
    if sun_inclination > np.pi / 2:
        return 0.0, period  # Never in shadow (or always - depends on geometry)

    # Simplified: assume circular orbit for shadow duration estimate
    r = (r_p + r_a) / 2
    earth_angle = 2 * np.arcsin(RE / r)  # Angular size of Earth from orbit

    shadow_fraction = earth_angle / (2 * np.pi)
    shadow_duration = period * shadow_fraction
    sunlight_duration = period - shadow_duration

    return shadow_duration, sunlight_duration
