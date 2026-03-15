# Marine Preset Expansion Spec

Reference document for implementing four new marine presets in `packages/presets/src/library.ts`.

All presets use `category: "marine"`. Insert after `marine-vessel-seasonal-care` and before `aircraft-piston-single-engine`.

---

## Preset 1: Outboard Boat

- **Key:** `marine-outboard-boat`
- **Label:** `Outboard Boat`
- **Tags:** `["marine", "boat", "outboard", "powerboat", "fishing"]`
- **Description:** "A maintenance profile for outboard-powered boats including fishing boats, center consoles, deck boats, and pontoons. Covers outboard engine service, lower unit care, propeller and anode replacement, fuel system management, trailer upkeep, safety equipment, and seasonal commissioning."

### Custom Fields

#### Group: Hull & Registration
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| hin | Hull Identification Number (HIN) | string | **required**, placeholder "XXBXXXXX X XXX" |
| year | Year | number | |
| make | Make | string | placeholder "Boston Whaler" |
| model | Model | string | placeholder "Montauk 170" |
| hullMaterial | Hull Material | select | fiberglass, aluminum, polyethylene, inflatable, wood, other |
| lengthFeet | Length (ft) | number | |
| registrationNumber | State Registration Number | string | |
| registrationState | Registration State | string | |

#### Group: Engine
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| engineCount | Number of Engines | number | helpText "Most outboard boats run one or two engines. Multi-engine schedules apply per engine." |
| engineMake | Engine Make | string | placeholder "Yamaha" |
| engineModel | Engine Model | string | placeholder "F150XB" |
| engineSerial | Engine Serial Number | string | |
| horsepower | Horsepower | number | |
| engineStroke | Engine Type | select | 4-stroke, 2-stroke, direct injection 2-stroke |
| fuelType | Fuel Type | select | gasoline, ethanol-free, diesel, other |

#### Group: Propeller & Drive
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| propMaterial | Propeller Material | select | aluminum, stainless steel, composite |
| propPitch | Prop Pitch / Size | string | placeholder "13 x 21" |
| propPartNumber | Propeller Part Number | string | |

#### Group: Trailer
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| hasTrailer | Stored on Trailer | boolean | defaultValue true |
| trailerMake | Trailer Make | string | |
| trailerVIN | Trailer VIN | string | |
| trailerTireSize | Trailer Tire Size | string | |

#### Group: Operations & Storage
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| marina | Marina / Ramp / Storage Facility | string | |
| storageType | Storage Type | select | trailer in driveway, dry stack, wet slip, mooring, boatyard, other |
| insuranceProvider | Insurance Provider | string | |
| preferredMechanic | Preferred Marine Mechanic or Dealer | string | |

### Metrics
| key | name | unit | helpText |
|-----|------|------|----------|
| engine_hours | Engine Hours | hours | "Primary metric for outboard service intervals. Update after each trip from the engine hour meter or gauge." |

### Schedules

| # | key | name | description | trigger | lead | notification | tags |
|---|-----|------|-------------|---------|------|-------------|------|
| 1 | engine_oil | Engine Oil and Filter Change | Most four-stroke outboards call for oil and filter changes every 100 hours or annually. Two-stroke oil-injected engines consume oil continuously but still need periodic gear inspection. Adjust interval to match your engine manufacturer. | compound: 365d / 100h whichever_first | 21d / 10h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 10 | engine, fluids, oil |
| 2 | lower_unit_oil | Lower Unit Gear Oil Change | Lower unit oil protects the gears and bearings that transfer power to the propeller. Milky or metallic oil on drain is an early warning for seal failure or gear wear. Change every 100 hours or annually. | compound: 365d / 100h whichever_first | 21d / 10h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 10 | engine, lower unit, fluids |
| 3 | spark_plugs | Spark Plug Inspection and Replacement | Replace plugs on schedule rather than waiting for misfires or hard starting. Use the manufacturer-specified plug and gap. | compound: 365d / 200h whichever_first | 21d / 20h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 20 | engine, ignition |
| 4 | fuel_filter_separator | Fuel Filter / Water Separator | Marine fuel systems are more prone to water contamination than automotive systems. Inspect the bowl regularly and replace the element on a defined schedule. | compound: 365d / 100h whichever_first | 14d / 10h | standardPushDigest + upcomingLeadDays 14, upcomingLeadValue 10 | engine, fuel, filters |
| 5 | impeller_replacement | Water Pump Impeller Replacement | The raw water pump impeller is a rubber wear item that can fail without warning and overheat the engine. Replace proactively rather than waiting for a temp alarm on the water. | compound: 730d / 300h whichever_first | 30d / 30h | standardPushDigest + upcomingLeadDays 30, upcomingLeadValue 30 | engine, cooling, impeller |
| 6 | anodes | Anode (Zinc / Aluminum) Inspection and Replacement | Sacrificial anodes protect the lower unit, trim tabs, and any underwater metal from galvanic corrosion. Inspect at every haul-out and replace when more than half consumed. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | corrosion, anodes, hull |
| 7 | propeller_inspection | Propeller Inspection | Check for dings, bends, fishing line wrap on the shaft, and hub wear. A damaged prop costs fuel economy, performance, and can vibrate the lower unit. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | propeller, inspection, drive |
| 8 | steering_service | Steering System Service | Grease cable-steered helms or check hydraulic steering fluid level and lines. Stiff or sloppy steering is a safety issue, not just a comfort issue. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | steering, safety, controls |
| 9 | bilge_pump_test | Bilge Pump Test | Test the float switch and pump operation. A failed bilge pump can sink a boat at the dock. | interval: 90d | 7d | standardPushDigest + upcomingLeadDays 7, overdueCadenceDays 14, maxOverdueNotifications 3 | safety, bilge, electrical |
| 10 | battery_service | Battery Service | Check terminals, charge level, electrolyte if applicable, and connections. Marine environments corrode terminals faster than automotive. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | electrical, battery |
| 11 | hull_cleaning | Hull Cleaning and Bottom Inspection | Clean growth, inspect the hull for blisters or damage, and repaint bottom paint if the boat lives in the water. Even trailered boats need periodic hull inspection. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | hull, cleaning, bottom paint |
| 12 | through_hull_inspection | Through-Hull and Drain Plug Inspection | Inspect every through-hull fitting, hose clamp, and the drain plug for corrosion, cracking, and secure fit. A failed through-hull sinks boats. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | hull, safety, fittings |
| 13 | electrical_corrosion_check | Electrical Connection and Corrosion Check | Inspect battery switches, terminal blocks, and wire connections for corrosion and heat damage. Marine electrical failures are progressive and often invisible. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | electrical, corrosion, inspection |
| 14 | safety_equipment | Safety Equipment Inspection | Check PFDs for condition and fit, verify flares are not expired, test horn, inspect fire extinguisher gauge and expiration, and confirm throwable device is accessible. This is a legal and safety requirement. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 4 | safety, legal, equipment |
| 15 | trailer_bearing_service | Trailer Wheel Bearing Service | Repack or replace trailer wheel bearings. Bearing failure on the road is one of the most common and preventable towing disasters. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | trailer, bearings, towing |
| 16 | trailer_lights_brakes | Trailer Lights, Brakes, and Tire Check | Verify all lights work after wiring is exposed to water, check brake function if equipped, and inspect tire condition and pressure. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | trailer, lights, brakes |
| 17 | registration_renewal | Boat Registration Renewal | State registration expiration varies by state. Track it like a real operational deadline. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | registration, legal, ownership |
| 18 | insurance_renewal | Boat Insurance Renewal | Review coverage, agreed hull value, and any navigation limits before renewal. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | insurance, ownership, legal |
| 19 | winterize | Winterize Engine and Systems | Fog the engine, stabilize fuel, drain or antifreeze raw water systems, disconnect the battery, and protect the boat and trailer for winter storage. | seasonal: month 10, day 15 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, winter, storage |
| 20 | dewinterize | Spring Commissioning and Launch Prep | Reverse winterization, inspect all systems, charge or replace the battery, check the trailer, and perform a thorough pre-season review before the first trip. | seasonal: month 4, day 1 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, spring, commissioning |

---

## Preset 2: Inboard / Sterndrive (I/O) Boat

- **Key:** `marine-inboard-sterndrive`
- **Label:** `Inboard / Sterndrive (I/O) Boat`
- **Tags:** `["marine", "boat", "inboard", "sterndrive", "I/O", "cruiser"]`
- **Description:** "A maintenance profile for boats with inboard engines and sterndrive or direct-drive configurations, including bowriders, cruisers, ski boats, and wake boats. Adds exhaust riser and manifold tracking, bellows and gimbal bearing service, closed cooling system maintenance, and drive-specific service on top of standard marine engine and hull care."

### Custom Fields

#### Group: Hull & Registration
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| hin | Hull Identification Number (HIN) | string | **required** |
| year | Year | number | |
| make | Make | string | placeholder "Sea Ray" |
| model | Model | string | placeholder "SLX 250" |
| hullMaterial | Hull Material | select | fiberglass, aluminum, composite, other |
| lengthFeet | Length (ft) | number | |
| registrationNumber | State Registration Number | string | |

#### Group: Engine
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| engineMake | Engine Make | string | placeholder "MerCruiser" |
| engineModel | Engine Model | string | placeholder "6.2L MPI" |
| engineSerial | Engine Serial Number | string | |
| horsepower | Horsepower | number | |
| fuelType | Fuel Type | select | gasoline, ethanol-free, diesel, other |
| coolingType | Cooling System | select | raw water, closed (freshwater), half system — helpText "Closed cooling systems add coolant service but protect the engine block from salt and sediment. Raw water systems are simpler but more corrosion-prone." |

#### Group: Drive System
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| driveType | Drive Configuration | select | sterndrive / I/O, V-drive, direct inboard, jet drive |
| driveModel | Outdrive / Transmission Model | string | placeholder "Alpha One Gen II, Bravo III" |
| bellowsType | Bellows Type | select | exhaust, U-joint, shift cable, not applicable |
| propType | Propeller Type / Size | string | |

#### Group: Trailer & Storage
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| hasTrailer | Stored on Trailer | boolean | defaultValue true |
| trailerMake | Trailer Make | string | |
| trailerTireSize | Trailer Tire Size | string | |
| storageType | Storage Type | select | trailer, dry stack, wet slip, mooring, boatyard, other |

#### Group: Operations & Support
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| marina | Marina / Storage Facility | string | |
| insuranceProvider | Insurance Provider | string | |
| preferredMechanic | Preferred Marine Mechanic or Dealer | string | |

### Metrics
| key | name | unit | helpText |
|-----|------|------|----------|
| engine_hours | Engine Hours | hours | "Primary service metric. Update from the engine hour gauge after each trip." |

### Schedules

| # | key | name | description | trigger | lead | notification | tags |
|---|-----|------|-------------|---------|------|-------------|------|
| 1 | engine_oil | Engine Oil and Filter Change | Inboard marine engines typically follow a 100-hour or annual oil change interval. Use marine-rated oil — automotive oil may lack the corrosion inhibitors needed for intermittent marine use. | compound: 365d / 100h whichever_first | 21d / 10h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 10 | engine, fluids, oil |
| 2 | sterndrive_oil | Sterndrive / Outdrive Gear Oil Change | The outdrive gear case protects gears and bearings that live partially submerged. Check for water intrusion on every drain. Milky oil means a seal has failed. | compound: 365d / 100h whichever_first | 21d / 10h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 10 | drive, fluids, lower unit |
| 3 | spark_plugs | Spark Plug Replacement | Replace on schedule to prevent misfires and rough running. | compound: 365d / 200h whichever_first | 21d / 20h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 20 | engine, ignition |
| 4 | fuel_filter_separator | Fuel Filter / Water Separator | Marine fuel picks up water from condensation and contaminated fuel docks. Inspect the bowl and replace the element regularly. | compound: 365d / 100h whichever_first | 14d / 10h | standardPushDigest + upcomingLeadDays 14, upcomingLeadValue 10 | engine, fuel, filters |
| 5 | impeller_replacement | Raw Water Pump Impeller Replacement | The impeller cools the engine or the heat exchanger depending on your cooling configuration. Failure causes rapid overheating. Replace proactively. | compound: 730d / 300h whichever_first | 30d / 30h | standardPushDigest + upcomingLeadDays 30, upcomingLeadValue 30 | engine, cooling, impeller |
| 6 | coolant_service | Closed Cooling System Service | If the boat has closed cooling, inspect hoses and clamps, check coolant level and condition, and replace coolant per manufacturer interval. Skip for raw-water-only systems. | interval: 730d | 30d | standardPushDigest + upcomingLeadDays 30 | engine, cooling, coolant |
| 7 | raw_water_strainer | Raw Water Strainer Cleaning | The raw water strainer catches debris before the impeller. Neglecting it accelerates impeller wear and can cause sudden overheating. | interval: 30d | 5d | standardPushDigest + upcomingLeadDays 5, overdueCadenceDays 14, maxOverdueNotifications 3 | engine, cooling, filters |
| 8 | exhaust_riser_manifold | Exhaust Riser and Manifold Inspection | Riser and manifold failure is one of the most expensive and common inboard problems. Internal corrosion allows water into the engine. Inspect on a defined schedule and replace based on hours and age. | compound: 1095d / 500h whichever_first | 60d / 50h | channels push+email+digest, digest true, upcomingLeadDays 60, upcomingLeadValue 50, overdueCadenceDays 14, maxOverdueNotifications 6 | engine, exhaust, major |
| 9 | bellows_inspection | Bellows Inspection | Sterndrive bellows keep water out of the bilge at the transom penetration. A cracked bellows can sink the boat. Inspect annually and replace on a calendar schedule even if they look fine. | interval: 365d | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | drive, bellows, safety |
| 10 | bellows_replacement | Bellows Replacement | Replace all bellows as a set on a defined interval regardless of visual condition. Rubber degrades from the inside. | interval: 1825d | 90d | channels push+email+digest, digest true, upcomingLeadDays 90, overdueCadenceDays 14, maxOverdueNotifications 6 | drive, bellows, major |
| 11 | gimbal_bearing | Gimbal Bearing Service | The gimbal bearing supports the drive shaft at the transom. A worn bearing causes vibration, noise, and accelerated wear on the U-joints and coupler. | compound: 1095d / 400h whichever_first | 30d / 40h | standardPushDigest + upcomingLeadDays 30, upcomingLeadValue 40 | drive, bearing, drivetrain |
| 12 | anodes | Anode Inspection and Replacement | Sacrificial anodes protect the outdrive, trim tabs, and through-hulls. Inspect at every haul-out and replace when more than half consumed. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | corrosion, anodes, drive |
| 13 | propeller_inspection | Propeller Inspection | Check for dings, line wrap, and hub wear. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | propeller, inspection |
| 14 | steering_service | Steering System Service | Service hydraulic or mechanical steering. Inboard boats often have more complex steering linkage than outboard boats. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | steering, controls, safety |
| 15 | bilge_pump_test | Bilge Pump Test | Test the float switch and pump. Inboard boats take on more water through stuffing boxes, shaft seals, and drivetrain penetrations than outboards. | interval: 90d | 7d | standardPushDigest + upcomingLeadDays 7, overdueCadenceDays 14, maxOverdueNotifications 3 | safety, bilge, electrical |
| 16 | battery_service | Battery Service | Check terminals, charge level, and connections. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | electrical, battery |
| 17 | hull_cleaning | Hull Cleaning and Bottom Inspection | Clean growth, inspect for blisters, and assess bottom paint if applicable. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | hull, cleaning, bottom paint |
| 18 | through_hull_inspection | Through-Hull and Seacock Inspection | Exercise all seacocks and inspect through-hull fittings, hose clamps, and below-waterline penetrations. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | hull, safety, fittings |
| 19 | safety_equipment | Safety Equipment Inspection | PFDs, flares, fire extinguisher, horn, throwable device, and navigation lights. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 4 | safety, legal, equipment |
| 20 | trailer_bearing_service | Trailer Wheel Bearing Service | Repack or replace bearings annually if trailer-stored. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | trailer, bearings |
| 21 | trailer_lights_brakes | Trailer Lights, Brakes, and Tire Check | Verify lights, brake function, and tire condition. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | trailer, lights, brakes |
| 22 | registration_renewal | Boat Registration Renewal | Track state registration as a real deadline. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | registration, legal, ownership |
| 23 | insurance_renewal | Boat Insurance Renewal | Review hull value and coverage before renewal. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | insurance, ownership, legal |
| 24 | winterize | Winterize Engine and Systems | Drain or antifreeze the cooling system, fog the engine, stabilize fuel, service the outdrive, disconnect battery, and protect the boat for storage. | seasonal: month 10, day 15 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, winter, storage |
| 25 | dewinterize | Spring Commissioning and Launch Prep | Reverse winterization, inspect bellows and drive components, charge the battery, and perform a full pre-season review. | seasonal: month 4, day 1 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, spring, commissioning |

---

## Preset 3: Jet Ski / Personal Watercraft (PWC)

- **Key:** `marine-pwc-jet-ski`
- **Label:** `Jet Ski / Personal Watercraft (PWC)`
- **Tags:** `["marine", "PWC", "jet ski", "personal watercraft", "waverunner"]`
- **Description:** "A maintenance profile for personal watercraft including Yamaha WaveRunners, Sea-Doo, and Kawasaki Jet Skis. Built around the jet pump drivetrain, high-RPM engine service cadence, and the unique wear items that come with shallow-water, high-intensity operation."

### Custom Fields

#### Group: Hull & Registration
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| hin | Hull Identification Number (HIN) | string | **required** |
| year | Year | number | |
| make | Make | string | placeholder "Yamaha" |
| model | Model | string | placeholder "FX Cruiser SVHO" |
| hullColor | Hull Color | string | |
| registrationNumber | State Registration Number | string | |
| riderCapacity | Rider Capacity | number | |

#### Group: Engine
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| engineType | Engine Type | select | 4-stroke, 2-stroke, Rotax ACE, other |
| supercharged | Supercharged / Turbocharged | boolean | defaultValue false, helpText "Supercharged models add intercooler and supercharger service to the maintenance profile." |
| fuelType | Fuel Type | select | gasoline, ethanol-free, other |
| oilType | Oil Type / Weight | string | |

#### Group: Jet Pump & Drive
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| pumpType | Jet Pump Model | string | |
| wearRingMaterial | Wear Ring Material | select | stainless, plastic / polymer, other |
| impellerMaterial | Impeller Material | select | stainless, aluminum, other |

#### Group: Operations & Storage
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| storageLocation | Storage Location | string | |
| hasTrailer | Stored on Trailer | boolean | defaultValue true |
| coverInstalled | Cover / Lift Installed | boolean | defaultValue false |
| insuranceProvider | Insurance Provider | string | |

### Metrics
| key | name | unit | helpText |
|-----|------|------|----------|
| engine_hours | Engine Hours | hours | "PWCs accumulate hours fast in short sessions. Track from the onboard gauge or ECU readout." |

### Schedules

| # | key | name | description | trigger | lead | notification | tags |
|---|-----|------|-------------|---------|------|-------------|------|
| 1 | engine_oil | Engine Oil and Filter Change | PWCs run at high RPM for sustained periods. Most four-stroke models call for oil and filter changes every 50 hours or annually. Check manufacturer recommendations. | compound: 365d / 50h whichever_first | 14d / 5h | standardPushDigest + upcomingLeadDays 14, upcomingLeadValue 5 | engine, fluids, oil |
| 2 | spark_plugs | Spark Plug Replacement | High-RPM operation fouls plugs faster. Replace per manufacturer interval. | compound: 365d / 100h whichever_first | 21d / 10h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 10 | engine, ignition |
| 3 | fuel_filter | Fuel Filter Replacement | PWCs ingest debris-laden water near fuel docks and in shallow water. A clogged fuel filter causes loss of power at the worst time. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | engine, fuel, filters |
| 4 | jet_pump_inspection | Jet Pump and Intake Grate Inspection | Inspect the jet pump housing, intake grate, and drive shaft seal for debris damage, wear, and fishing line wrap. The pump is the entire propulsion system. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | jet pump, drive, inspection |
| 5 | wear_ring_inspection | Wear Ring Inspection and Replacement | The wear ring is the tight tolerance between the impeller and the pump housing. A worn ring causes cavitation, lost thrust, and reduced top speed. This is the single most common PWC performance complaint. | usage: 200h | 20h | standardPushDigest + upcomingLeadValue 20 | jet pump, wear ring, drive |
| 6 | impeller_inspection | Impeller Inspection | Inspect the impeller for dings, erosion, and edge damage from sand and debris. A damaged impeller reduces efficiency and accelerates wear ring degradation. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | jet pump, impeller, drive |
| 7 | ride_plate_inspection | Ride Plate and Trim Check | Inspect the ride plate for dents and damage. Even minor bends change handling characteristics at speed. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | hull, ride plate, handling |
| 8 | throttle_steering_cable | Throttle and Steering Cable Lubrication | PWC cables live in a wet, salt-exposed environment. Lubricate on a regular schedule to prevent stiffness and sudden binding. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | controls, steering, cables |
| 9 | supercharger_service | Supercharger / Intercooler Service | Supercharged models need periodic supercharger rebuild and intercooler inspection. The supercharger is a high-cost wear item with a defined service life. Skip for naturally aspirated models. | usage: 200h | 20h | channels push+email+digest, digest true, upcomingLeadValue 20, overdueCadenceDays 14, maxOverdueNotifications 6 | engine, supercharger, major |
| 10 | battery_service | Battery Service | PWC batteries are small and work hard. Check charge, terminals, and capacity. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | electrical, battery |
| 11 | hull_cleaning | Hull and Intake Cleaning | Clean marine growth, inspect the hull for damage, and clear the intake grate area. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | hull, cleaning |
| 12 | bilge_drainage | Bilge and Hull Drainage Check | PWCs accumulate water internally. Inspect drain plugs, bilge areas, and hull cavities for standing water that can cause mold, corrosion, and added weight. | interval: 90d | 7d | standardPushDigest + upcomingLeadDays 7 | hull, bilge, drainage |
| 13 | brake_system | Intelligent Braking / Deceleration System Check | Models equipped with iBR, RIDE, or similar braking systems have additional linkage and actuators that need periodic inspection. Skip for models without a braking system. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | controls, braking, safety |
| 14 | safety_equipment | Safety Equipment Check | Verify PFDs, lanyard / kill switch, fire extinguisher, registration, and sound-signaling device. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 4 | safety, legal, equipment |
| 15 | trailer_service | Trailer Bearings, Lights, and Tires | PWC trailers are light-duty but see the same water submersion as full-size boat trailers. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | trailer, bearings, towing |
| 16 | registration_renewal | Registration Renewal | Track state PWC registration as an expiration deadline. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | registration, legal, ownership |
| 17 | insurance_renewal | Insurance Renewal | Review coverage and agreed value. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | insurance, ownership, legal |
| 18 | winterize | Winterize and Storage Prep | Flush the cooling system, fog the engine, stabilize fuel, remove the battery, and protect the hull for winter storage. | seasonal: month 10, day 15 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, winter, storage |
| 19 | dewinterize | Spring Commissioning | Reverse winterization, reconnect the battery, inspect the jet pump and hull, and perform a test run before the season. | seasonal: month 4, day 1 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, spring, commissioning |

---

## Preset 4: Sailboat

- **Key:** `marine-sailboat`
- **Label:** `Sailboat`
- **Tags:** `["marine", "boat", "sailboat", "sailing", "cruising"]`
- **Description:** "A comprehensive maintenance profile for sailboats that balances rigging and sail care with auxiliary engine service, hull maintenance, and the hardware-intensive systems unique to sailing vessels. Covers standing and running rigging lifecycle, winch and hardware service, keel and rudder inspection, and seasonal haul-out planning."

### Custom Fields

#### Group: Hull & Registration
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| hin | Hull Identification Number (HIN) | string | **required** |
| year | Year | number | |
| make | Make | string | placeholder "Catalina" |
| model | Model | string | placeholder "315" |
| loa | LOA (ft) | number | helpText "Length overall in feet." |
| beam | Beam (ft) | number | |
| draft | Draft (ft) | number | |
| hullMaterial | Hull Material | select | fiberglass, composite, aluminum, steel, wood, ferro-cement, other |
| registrationNumber | State Registration or Documentation Number | string | |

#### Group: Rig & Sails
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| mastMaterial | Mast Material | select | aluminum, carbon fiber, wood |
| riggingType | Standing Rigging Type | select | wire (1x19), wire (7x19), rod, synthetic (Dyneema), other |
| rigAge | Rig Age (years) | number | helpText "Years since the standing rigging was last replaced. Most riggers recommend replacement every 10-20 years depending on material and use." |
| keelType | Keel Type | select | fin, wing, full, centerboard, swing, bulb, other |
| mainsailArea | Mainsail Area (sq ft) | number | helpText "Optional but useful for tracking sail size and replacement." |
| headsailType | Primary Headsail | select | roller furling jib, roller furling genoa, hank-on jib, hank-on genoa, self-tacking jib, other |

#### Group: Auxiliary Engine
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| auxiliaryEngineType | Auxiliary Engine Type | select | diesel inboard, gasoline inboard, outboard, electric, none |
| auxiliaryEngineMake | Engine Make | string | placeholder "Yanmar" |
| auxiliaryEngineModel | Engine Model | string | placeholder "3YM20" |
| auxiliaryEngineSerial | Engine Serial | string | |
| auxiliaryEngineHorsepower | Horsepower | number | |

#### Group: Operations & Storage
| key | label | type | options / notes |
|-----|-------|------|-----------------|
| marina | Marina / Mooring Location | string | |
| storageType | Storage Type | select | wet slip, mooring, dry sail, trailer, boatyard, other |
| insuranceProvider | Insurance Provider | string | |
| preferredRigger | Preferred Rigger / Sailmaker | string | |

### Metrics
| key | name | unit | helpText |
|-----|------|------|----------|
| engine_hours | Engine Hours | hours | "Auxiliary engine hours. Used for engine oil, impeller, and belt service intervals." |
| sailing_hours | Sailing Hours | hours | startingValue 0, allowManualEntry true, helpText "Optional. Track time under sail for rigging wear and sail service planning." |

### Schedules

| # | key | name | description | trigger | lead | notification | tags |
|---|-----|------|-------------|---------|------|-------------|------|
| 1 | standing_rigging_inspection | Standing Rigging Inspection | Inspect shrouds, stays, turnbuckles, swages, and terminal fittings for corrosion, cracking, and meat hooks. Standing rigging failure is catastrophic and usually preventable. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 6 | rigging, safety, inspection |
| 2 | standing_rigging_replacement | Standing Rigging Replacement Planning | Wire rigging is typically replaced every 10-15 years, rod every 15-20, and synthetic on inspection. Track age and plan the replacement as a major maintenance event with rigger lead time. | interval: 3650d | 365d | channels push+email+digest, digest true, upcomingLeadDays 365, overdueCadenceDays 30, maxOverdueNotifications 6 | rigging, major, replacement |
| 3 | running_rigging_inspection | Running Rigging Inspection | Inspect halyards, sheets, control lines, and shackles for chafe, UV degradation, and core-sheath separation. Replace individual lines as needed rather than waiting for failure. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | rigging, lines, inspection |
| 4 | winch_service | Winch Teardown and Service | Disassemble, clean, and grease all winches. Neglected winches lose holding power and can release sheets unexpectedly. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | hardware, winches, lubrication |
| 5 | roller_furling_service | Roller Furling System Service | Inspect the foil, drum, bearings, swivel, and furling line for wear and smooth operation. A jammed furler in heavy weather is a serious safety problem. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | rigging, furling, hardware |
| 6 | sail_inspection | Sail Inspection and Cleaning | Inspect stitching, UV covers, batten pockets, luff tape, and hardware attachment points. Rinse and dry sails before extended storage. Have a sailmaker assess any chafe or damage. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | sails, inspection, cleaning |
| 7 | mast_hardware | Mast Hardware and Sheave Inspection | Inspect masthead, spreader tips, sheaves, halyards at exit points, and wiring runs in the mast for corrosion and wear. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | rigging, mast, hardware |
| 8 | keel_bolt_inspection | Keel Bolt Inspection | Inspect keel bolts and the keel-to-hull joint for weeping, corrosion stains, or any sign of movement. Keel detachment is rare but fatal when it happens. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 6 | hull, keel, safety |
| 9 | rudder_inspection | Rudder Bearing and Hardware Inspection | Check the rudder post, bearings, stuffing box or lip seal, and tiller or quadrant hardware for play and wear. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | hull, rudder, steering |
| 10 | chainplate_inspection | Chainplate Inspection | Chainplates connect the standing rigging to the hull structure. Inspect for corrosion, especially where they pass through the deck. Hidden corrosion under deck is common on older boats. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 4 | rigging, chainplates, structure |
| 11 | through_hull_seacock | Through-Hull and Seacock Service | Exercise every seacock through its full range, inspect the through-hull fitting, and check hose clamps. A seized seacock cannot be closed in an emergency. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | hull, safety, seacocks |
| 12 | bottom_paint_haulout | Bottom Paint and Haul-Out | Haul the boat, clean and inspect the bottom, repair gel coat, and apply antifouling paint. Schedule this as a deliberate annual or biennial event with yard lead time. | interval: 365d | 30d | standardPushDigest + upcomingLeadDays 30 | hull, bottom paint, haul-out |
| 13 | engine_oil | Auxiliary Engine Oil and Filter Change | Even lightly used auxiliary diesels need regular oil changes. Low-hour engines that sit for months still degrade oil. | compound: 365d / 100h whichever_first | 21d / 10h | standardPushDigest + upcomingLeadDays 21, upcomingLeadValue 10 | engine, fluids, oil |
| 14 | engine_impeller | Auxiliary Engine Raw Water Impeller | The raw water pump impeller is a wear item on auxiliary diesels and outboards. Replace proactively. | compound: 730d / 300h whichever_first | 30d / 30h | standardPushDigest + upcomingLeadDays 30, upcomingLeadValue 30 | engine, cooling, impeller |
| 15 | engine_anodes | Auxiliary Engine and Saildrive Anodes | Protect the engine heat exchanger and saildrive or shaft with sacrificial anodes. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | engine, corrosion, anodes |
| 16 | engine_belt | Auxiliary Engine Belt Inspection | Inspect alternator and raw water pump belts for tension, glazing, and cracking. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | engine, belts, electrical |
| 17 | fuel_filter | Auxiliary Engine Fuel Filter | Diesel fuel grows algae and collects water. Replace primary and secondary fuel filters regularly. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | engine, fuel, filters |
| 18 | head_holding_tank | Head and Holding Tank Service | Service the marine head, inspect hoses for permeation, and pump or clean the holding tank. | interval: 365d | 21d | standardPushDigest + upcomingLeadDays 21 | plumbing, head, sanitation |
| 19 | water_system | Freshwater System Sanitization | Sanitize the freshwater tank and run the watermaker if equipped. Flush lines after storage. | interval: 365d | 14d | standardPushDigest + upcomingLeadDays 14 | plumbing, freshwater, sanitation |
| 20 | battery_electrical | Battery and Electrical System Check | Check house and starting batteries, charge controllers, shore power connections, and wiring for corrosion. | interval: 180d | 14d | standardPushDigest + upcomingLeadDays 14 | electrical, battery |
| 21 | bilge_pump_test | Bilge Pump Test | Test automatic and manual bilge pumps and float switches. | interval: 90d | 7d | standardPushDigest + upcomingLeadDays 7, overdueCadenceDays 14, maxOverdueNotifications 3 | safety, bilge, electrical |
| 22 | safety_equipment | Safety Equipment Inspection | PFDs, flares, fire extinguisher, EPIRB or PLB battery and registration, throwable device, jack lines, tether gear, and navigation lights. | interval: 365d | 30d | channels push+email+digest, digest true, upcomingLeadDays 30, overdueCadenceDays 14, maxOverdueNotifications 4 | safety, legal, equipment |
| 23 | registration_renewal | Registration / Documentation Renewal | State registration or USCG documentation renewal. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | registration, legal, ownership |
| 24 | insurance_renewal | Insurance Renewal | Review hull value, navigation limits, and liveaboard or charter endorsements if applicable. | interval: 365d | 60d | channels push+email+digest, digest true, upcomingLeadDays 60, overdueCadenceDays 7, maxOverdueNotifications 6 | insurance, ownership, legal |
| 25 | winterize | Winterize and Decommission | Winterize the engine, water systems, and head. Remove sails or cover, disconnect batteries, set dock lines for winter conditions, and protect the rig. | seasonal: month 10, day 15 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, winter, storage |
| 26 | dewinterize | Spring Commissioning | Reverse winterization, step or inspect the mast, bend on sails, commission the engine, charge batteries, and perform a shakedown sail before the season. | seasonal: month 4, day 1 | 21d | channels push+email+digest, digest true, upcomingLeadDays 21, overdueCadenceDays 7, maxOverdueNotifications 6 | seasonal, spring, commissioning |
