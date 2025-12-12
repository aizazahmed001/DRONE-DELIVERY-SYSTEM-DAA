/**
 * DRONE DELIVERY OPTIMIZATION ALGORITHM
 * Implementation of Greedy + Nearest Neighbor TSP + 2-Opt
 * 
 * Time Complexity: O(k × n²)
 * Space Complexity: O(n²)
 */

class Zone {
    constructor(id, priority, demand, lat, lng) {
        this.id = id;
        this.priority = priority; // 1=critical, 2=moderate, 3=low
        this.demand = demand;
        this.lat = lat;
        this.lng = lng;
        this.served = false;
    }
}

class Drone {
    constructor(id, batteryCapacity, payloadCapacity) {
        this.id = id;
        this.batteryCapacity = batteryCapacity;
        this.payloadCapacity = payloadCapacity;
        this.route = [];
        this.totalDistance = 0;
        this.totalDelivered = 0;
    }
}

class DroneDeliveryOptimizer {
    constructor() {
        this.zones = [];
        this.drones = [];
        this.distanceMatrix = [];
        this.baseLocation = null;
        this.executionTime = 0;
    }

    /**
     * Set the base location for drones
     */
    setBase(lat, lng) {
        this.baseLocation = { lat, lng, id: 0 };
        // Insert base at index 0
        this.zones = [
            { id: 0, priority: 0, demand: 0, lat, lng, served: false },
            ...this.zones.filter(z => z.id !== 0)
        ];
    }

    /**
     * Add a relief zone
     */
    addZone(zone) {
        // Ensure IDs are unique and sequential
        zone.id = this.zones.filter(z => z.id !== 0).length + 1;
        this.zones.push(zone);
    }

    /**
     * Add a drone to the fleet
     */
    addDrone(drone) {
        this.drones.push(drone);
    }

    /**
     * Calculate Haversine distance between two coordinates (in km)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Build distance matrix for all zones
     * Complexity: O(n²)
     */
    buildDistanceMatrix() {
        const n = this.zones.length;
        this.distanceMatrix = Array(n).fill(null).map(() => Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i !== j) {
                    this.distanceMatrix[i][j] = this.calculateDistance(
                        this.zones[i].lat,
                        this.zones[i].lng,
                        this.zones[j].lat,
                        this.zones[j].lng
                    );
                }
            }
        }
    }

    /**
     * Sort zones by priority (critical first)
     * Complexity: O(n log n)
     */
    sortZonesByPriority() {
        // Keep base at index 0, sort rest
        const base = this.zones[0];
        const otherZones = this.zones.slice(1);

        otherZones.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority; // Lower priority number = higher importance
            }
            return b.demand - a.demand; // Higher demand first if same priority
        });

        this.zones = [base, ...otherZones];
    }

    /**
     * Nearest Neighbor TSP with priority weighting
     * Complexity: O(n²)
     */
    nearestNeighborTSP(availableZones, drone) {
        const route = [];
        const visited = new Set();
        const baseIdx = 0;

        let current = baseIdx;
        route.push(current);
        visited.add(current);

        let currentDistance = 0;

        while (true) {
            let nearest = -1;
            let minEffectiveDistance = Infinity;

            // Find nearest unvisited zone with priority weighting
            for (const zoneIdx of availableZones) {
                if (!visited.has(zoneIdx)) {
                    const dist = this.distanceMatrix[current][zoneIdx];
                    const zone = this.zones[zoneIdx];

                    // Apply priority weighting (divide by priority to favor critical zones)
                    const effectiveDist = dist / zone.priority;

                    // Check battery feasibility
                    const returnDist = this.distanceMatrix[zoneIdx][baseIdx];
                    const totalDist = currentDistance + dist + returnDist;

                    if (totalDist <= drone.batteryCapacity && effectiveDist < minEffectiveDistance) {
                        // Check payload capacity
                        const currentLoad = route
                            .filter(idx => idx !== baseIdx)
                            .reduce((sum, idx) => sum + this.zones[idx].demand, 0);

                        if (currentLoad + zone.demand <= drone.payloadCapacity) {
                            minEffectiveDistance = effectiveDist;
                            nearest = zoneIdx;
                        }
                    }
                }
            }

            if (nearest === -1) break; // No feasible zone found

            currentDistance += this.distanceMatrix[current][nearest];
            route.push(nearest);
            visited.add(nearest);
            current = nearest;
        }

        return route;
    }

    /**
     * 2-Opt optimization to improve route
     * Complexity: O(n² × iterations)
     */
    twoOptOptimize(route, maxDistance) {
        if (route.length < 4) return route;

        let improved = true;
        const baseIdx = 0;
        let iterations = 0;
        const maxIterations = 5;

        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;

            for (let i = 1; i < route.length - 2; i++) {
                for (let j = i + 1; j < route.length - 1; j++) {
                    // Calculate old distance
                    const oldDist = this.distanceMatrix[route[i - 1]][route[i]] +
                        this.distanceMatrix[route[j]][route[j + 1]];

                    // Calculate new distance after swap
                    const newDist = this.distanceMatrix[route[i - 1]][route[j]] +
                        this.distanceMatrix[route[i]][route[j + 1]];

                    if (newDist < oldDist) {
                        // Create test route with reversed segment
                        const testRoute = [...route];
                        this.reverseSegment(testRoute, i, j);

                        // Verify battery constraint
                        const totalDist = this.calculateRouteDistance(testRoute);

                        if (totalDist <= maxDistance) {
                            route = testRoute;
                            improved = true;
                        }
                    }
                }
            }
        }

        return route;
    }

    /**
     * Reverse a segment of the route
     */
    reverseSegment(route, start, end) {
        while (start < end) {
            [route[start], route[end]] = [route[end], route[start]];
            start++;
            end--;
        }
    }

    /**
     * Calculate total distance of a route
     */
    calculateRouteDistance(route) {
        if (route.length === 0) return 0;

        const baseIdx = 0;
        let totalDist = this.distanceMatrix[baseIdx][route[0]];

        for (let i = 0; i < route.length - 1; i++) {
            totalDist += this.distanceMatrix[route[i]][route[i + 1]];
        }

        totalDist += this.distanceMatrix[route[route.length - 1]][baseIdx];
        return totalDist;
    }

    /**
     * Main optimization algorithm
     * Complexity: O(k × n²)
     */
    optimize() {
        const startTime = performance.now();

        // Step 1: Build distance matrix - O(n²)
        this.buildDistanceMatrix();

        // Step 2: Sort zones by priority - O(n log n)
        this.sortZonesByPriority();

        // Step 3: Initialize
        this.zones.forEach(zone => zone.served = false);
        this.zones[0].served = true; // Base is always "served"

        const zoneAssigned = new Array(this.zones.length).fill(false);
        zoneAssigned[0] = true; // Base

        // Step 4: Assign routes to drones - O(k × n²)
        for (const drone of this.drones) {
            // Get available unserved zones within capacity
            const availableZones = [];

            for (let i = 1; i < this.zones.length; i++) {
                if (!zoneAssigned[i] && this.zones[i].demand <= drone.payloadCapacity) {
                    availableZones.push(i);
                }
            }

            if (availableZones.length === 0) continue;

            // Build route using Nearest Neighbor - O(n²)
            let route = this.nearestNeighborTSP(availableZones, drone);

            // Optimize route with 2-Opt - O(n²)
            if (route.length > 1) {
                route = this.twoOptOptimize(route, drone.batteryCapacity);
            }

            // Assign route to drone
            drone.route = route;
            drone.totalDistance = this.calculateRouteDistance(route);

            // Mark zones as assigned and calculate delivered supplies
            drone.totalDelivered = 0;
            for (const zoneIdx of route) {
                if (zoneIdx !== 0 && !zoneAssigned[zoneIdx]) {
                    zoneAssigned[zoneIdx] = true;
                    this.zones[zoneIdx].served = true;
                    drone.totalDelivered += this.zones[zoneIdx].demand;
                }
            }
        }

        const endTime = performance.now();
        this.executionTime = endTime - startTime;

        return this.getResults();
    }

    /**
     * Get optimization results
     */
    getResults() {
        const totalDistance = this.drones.reduce((sum, drone) => sum + drone.totalDistance, 0);
        const zonesServed = this.zones.filter(z => z.served && z.id !== 0).length;
        const totalZones = this.zones.length - 1; // Exclude base

        // Count by priority
        const criticalServed = this.zones.filter(z => z.served && z.priority === 1).length;
        const moderateServed = this.zones.filter(z => z.served && z.priority === 2).length;
        const lowServed = this.zones.filter(z => z.served && z.priority === 3).length;

        const totalCritical = this.zones.filter(z => z.priority === 1 && z.id !== 0).length;
        const totalModerate = this.zones.filter(z => z.priority === 2 && z.id !== 0).length;
        const totalLow = this.zones.filter(z => z.priority === 3 && z.id !== 0).length;

        // Calculate average battery usage
        const avgBatteryUsage = this.drones.reduce((sum, drone) => {
            return sum + (drone.totalDistance / drone.batteryCapacity * 100);
        }, 0) / this.drones.length;

        return {
            drones: this.drones.map(drone => ({
                id: drone.id,
                route: drone.route.map(idx => this.zones[idx]),
                totalDistance: drone.totalDistance,
                totalDelivered: drone.totalDelivered,
                batteryUsage: (drone.totalDistance / drone.batteryCapacity * 100).toFixed(1),
                routeIndices: drone.route
            })),
            summary: {
                totalDistance: totalDistance.toFixed(2),
                zonesServed,
                totalZones,
                criticalServed,
                moderateServed,
                lowServed,
                totalCritical,
                totalModerate,
                totalLow,
                avgBatteryUsage: avgBatteryUsage.toFixed(1),
                executionTime: this.executionTime.toFixed(2)
            }
        };
    }

    /**
     * Clear all data
     */
    clear() {
        this.zones = [];
        this.drones = [];
        this.distanceMatrix = [];
        this.baseLocation = null;
        this.executionTime = 0;
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DroneDeliveryOptimizer, Zone, Drone };
}