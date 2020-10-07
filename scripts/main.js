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

    console.log(neos);

    draw(neos);
}

function draw(neos) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
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

    neo['orbital_lane'] = orbitalLane(neo['orbit_id']);
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
    const PHO_DISTANCE_LD = 20;
    return neo['current_dist_ld'] < PHO_DISTANCE_LD;
}

function orbitalLane(orbitId) {
    return orbitId.slice(-1);
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