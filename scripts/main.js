const SECONDS_PER_DAY = 86400;

apiData();

function apiData() {
    const endpoint = "https://ssd-api.jpl.nasa.gov/cad.api";

    const startDate = dateString(new Date());
    const endDate = offsetDate(startDate);
    const limit = 50;

    $.ajax({
        url: endpoint + "?body=Earth&limit=" + limit + '&date-min=' + startDate + "&date-max=" + endDate,
        type: "GET",
        dataType: 'json',
        success: function (data) {
            handleData(data, startDate);
        }
    });
}

function handleData(data, startDate) {
    const fields = data.fields;
    const results = data.data;

    let allNeos = results.map(function (value) {
        let neo = setNeoBaseData(value, fields);
        neo = setNeoAdditionalData(neo, startDate);
        return neo;
    });

    let neos = allNeos.filter(potentiallyHazardousObjects);
    neos.sort((a, b) => a.current_dist_ld - b.current_dist_ld);

    draw(neos);
}

function draw(neos) {
    const ns = "http://www.w3.org/2000/svg";
    let svg = document.createElementNS(ns, "svg");

    const boxWidth = 1000;
    const boxHeight = 4000;

    svg.setAttributeNS(null, "viewBox", "0 0 " + boxWidth + " " + boxHeight);

    const laneWidth = boxWidth / 10;
    const ldMultiplier = 100;

    neos.forEach(function (neo) {
        let object = document.createElementNS(ns, "circle");

        object.setAttribute("cx", (xPosition(neo['orbit_id'], laneWidth)).toString());
        object.setAttribute("cy", (yPosition(neo['current_dist_ld'], ldMultiplier)).toString());
        object.setAttribute("r", (displayRadius(neo['diameter'])).toString());
        object.setAttribute("stroke", "#ffffff");
        object.setAttribute("fill", "#ffffff");

        svg.appendChild(object);
    });

    $("main").append(svg);
}

function dateString(date) {

    let month = date.getMonth() + 1;
    if (month < 10) {
        month = '0' + month;
    }

    const day = (date.getDate() < 10)
        ? '0' + date.getDate()
        : date.getDate();

    return date.getFullYear() + '-' + month + '-' + day;
}

function offsetDate(date, days) {

    if (typeof days === "undefined") {
        days = 90;
    }

    date2 = new Date(date);
    date2.setDate(date2.getDate() + days);

    return dateString(date2);
}

/**
 * Selects only essential API data
 * and adds their field names, which are provided separately.
 * @param {Array} baseData
 * @param {Array} fields
 * @returns {Array}
 */
function setNeoBaseData(baseData, fields) {
    let neo = [];

    neo[fields[0]] = baseData[0];
    neo[fields[1]] = baseData[1];
    neo[fields[3]] = baseData[3];
    neo[fields[4]] = baseData[4];
    neo[fields[7]] = baseData[7];
    neo[fields[10]] = baseData[10];

    return neo;
}

/**
 * Adds calculated data to the NEO.
 * @param {Array} neo
 * @param {string} startDate
 * @returns {Array}
 */
function setNeoAdditionalData(neo, startDate) {

    neo['closest_dist_ld'] = convertAuToLd(neo['dist']);
    neo['diameter'] = diameterFromMagnitude(neo['h']);
    neo['closest_date'] = dateFromCd(neo['cd']);
    neo['days_to_closest'] = daysDifference(startDate, neo['closest_date']);
    neo['ld_per_day'] = ldPerDay(neo['v_rel']);

    neo['current_dist_ld'] = currentDistance(
        neo['closest_dist_ld'],
        neo['ld_per_day'],
        neo['days_to_closest']
    );
    
    return neo;
}

/**
 * Filter for potentially hazardous objects,
 * or ones that have crossed within 20 lunar distances of Earth.
 * @param {Array} neo
 * @returns {boolean}
 */
function potentiallyHazardousObjects(neo) {
    const PHO_DISTANCE_LD = 40;
    return neo['current_dist_ld'] < PHO_DISTANCE_LD;
}

/**
 * Converts astronomical units (AU) to lunar distances (LD),
 * or the accepted distance from the Earth to its Moon.
 * @param {number} value
 * @returns {number}
 */
function convertAuToLd(value) {
    const AU_AS_LD = 0.002569;
    return value / AU_AS_LD;
}

/**
 * Calculate the diameter of the object from its absolute magnitude (H).
 * Albedo (reflectiveness) is given a value most often used by NASA JPL.
 * @param {number} h
 * @returns {number}
 */
function diameterFromMagnitude(h) {
    const ALBEDO = 0.14;
    const EQUATION_CONSTANT = 1329;

    return (
        Math.pow(10, -0.2 * h)
        / Math.sqrt(ALBEDO)
    ) * EQUATION_CONSTANT * 1000;
}

/**
 * Converts calendar date from API format
 * to string date for creating Date object.
 * @param {string} cd
 * @returns {string}
 */
function dateFromCd(cd) {

    const cdParts = cd.split(" ");
    const cdDateParts = cdParts[0].split("-");

    const months = {
        "Jan": "01",
        "Feb": "02",
        "Mar": "03",
        "Apr": "04",
        "May": "05",
        "Jun": "06",
        "Jul": "07",
        "Aug": "08",
        "Sep": "09",
        "Oct": "10",
        "Nov": "11",
        "Dec": "12"
    };

    return [cdDateParts[0], months[cdDateParts[1]], cdDateParts[2]]
        .join("-");
}

/**
 * Calculates the difference in days between two dates.
 * @param {string} earlierDate
 * @param {string} laterDate
 * @returns {number}
 */
function daysDifference(earlierDate, laterDate) {
    const timeDifference = Math.abs(new Date(laterDate) - new Date(earlierDate));
    return Math.ceil(timeDifference / (1000 * SECONDS_PER_DAY));
}

/**
 * Converts velocity in kilometers per second (Km/s)
 * to lunar distances (LD) per day.
 * @param {number} velocityKmS
 * @returns {number}
 */
function ldPerDay(velocityKmS) {
    const LD_TO_KM = 384402;
    return (velocityKmS * SECONDS_PER_DAY) / LD_TO_KM;
}

/**
 * Determines current distance in lunar distances (LD)
 * by offsetting closest approach distance by velocity in LD/day
 * times the number of days to closest approach.
 * @param {number} closestDistance
 * @param {number} velocity
 * @param {number} days
 * @returns {number}
 */
function currentDistance(closestDistance, velocity, days) {
    return closestDistance + (velocity * days);
}

/**
 * Determine the x position of the object based on its JPL orbit ID.
 * @param {number} orbitId
 * @param {number} laneWidth
 * @returns {number}
 */
function xPosition(orbitId, laneWidth) {
    return (orbitalLane(orbitId) * laneWidth) - (laneWidth / 2)
}

/**
 * Derive a lane in which to display the object from its assigned orbit.
 * @param {number} orbitId
 * @returns {number}
 */
function orbitalLane(orbitId) {
    return orbitId.slice(-1);
}

/**
 * Determine the y position of the object based on its current distance from Earth.
 * @param {number} distance
 * @param {number} ldMultiplier
 * @returns {number}
 */
function yPosition(distance, ldMultiplier) {
    return Math.ceil(distance * ldMultiplier);
}

/**
 * Determine the display radius of the object based on its diameter.
 * @param {number} diameter
 * @returns {number}
 */
function displayRadius(diameter) {

    const DEFAULT_DISPLAY_R = 80;

    const diameters = [
        {
            "min_d": 0,
            "max_d": 10,
            "display_r": 5
        },
        {
            "min_d": 10,
            "max_d": 30,
            "display_r": 10
        },
        {
            "min_d": 30,
            "max_d": 100,
            "display_r": 20
        },
        {
            "min_d": 100,
            "max_d": 1000,
            "display_r": 40
        },
        {
            "min_d": 1000,
            "max_d": null,
            "display_r": DEFAULT_DISPLAY_R
        }
    ];

    let displayR = DEFAULT_DISPLAY_R;

    let i = 0;
    const sizeCount = diameters.length;

    for (i; i < sizeCount; i++) {

        if (diameter >= diameters[i].min_d
            && (diameters[i].max_d === null || diameter < diameters[i].max_d)
        ) {
            displayR = diameters[i].display_r;
            break;
        }
    }

    return displayR;
}