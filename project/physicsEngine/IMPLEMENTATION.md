# Physics Engine Implementation Guide

This document explains how to implement the satellite physics engine used for orbital mechanics calculations.

## Overview

The physics engine is a Python extension module built with C++ and pybind11. It computes the gravitational acceleration on a satellite considering:

1. **Two-body gravity** (Keplerian motion)
2. **J2 perturbation** (Earth's oblateness)

## File Structure

```
project/physicsEngine/
├── calculation.cpp   # Core C++ physics calculations
├── setup.py         # Build configuration
└── main.py          # FastAPI endpoint
```

## Implementation Details

### 1. C++ Core (`calculation.cpp`)

The physics calculations are implemented in C++ for performance.

#### Constants
| Constant | Value | Description |
|----------|-------|-------------|
| `mu` | 398600.4418 km³/s² | Standard gravitational parameter of Earth |
| `Re` | 6378.137 km | Earth equatorial radius |
| `J2` | 1.08263e-3 | J2 zonal harmonic coefficient |

#### Two-Body Gravity
The central gravitational acceleration is computed using Newton's law:

```
a = -μ/r³ × r
```

Where `r` is the position vector and `μ` is the gravitational parameter.

#### J2 Perturbation
Earth's equatorial bulge causes additional acceleration:

```
ax_J2 = J2_factor × x × (5z²/r² - 1)
ay_J2 = J2_factor × y × (5z²/r² - 1)
az_J2 = J2_factor × z × (5z²/r² - 3)
```

Where:
```
J2_factor = (3/2) × J2 × μ × Re² / r⁵
```

### 2. Python Binding (`calculation.cpp` - lines 46-51)

Pybind11 exposes the C++ function to Python:

```cpp
PYBIND11_MODULE(physicsEngine, m) {
    m.def("acceleration", &satellite_acceleration,
          "Compute acceleration vector given position [x, y, z]");
}
```

### 3. Building the Module

Run the following to build:

```bash
cd project/physicsEngine
python setup.py build_ext --inplace
```

This creates `physicsEngine.pyd` (Windows) or `physicsEngine.so` (Linux/Mac).

### 4. API Usage (`main.py`)

```python
import physicsEngine

# Returns [ax, ay, az] in km/s²
acceleration = physicsEngine.acceleration([x, y, z])
```

## Usage Example

```python
import physicsEngine

# ISS approximate orbit altitude ~400km
position = [6778.137, 0, 0]  # km (Re + 400km)

acc = physicsEngine.acceleration(position)
print(f"Acceleration: {acc}")
# Output: approximately [0, -0.0588, 0] km/s²
```

## Extending the Engine

To add more perturbations (e.g., drag, solar radiation pressure, third-body gravity):

1. Add new constants at the top of `calculation.cpp`
2. Create additional functions for each perturbation
3. Sum all accelerations in `satellite_acceleration()`
4. Rebuild the module
