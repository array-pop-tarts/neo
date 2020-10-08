const endpoint = "https://ssd-api.jpl.nasa.gov/cad.api";
const nsSvg = "http://www.w3.org/2000/svg";
const nsXhtml = "http://www.w3.org/1999/xhtml";

const SECONDS_PER_DAY = 86400;
const container = $("main");

let startDate = dateString(new Date("2020-12-02"));
let viewingDistance = 40;
let neos = [];

apiData();

/**
 * Retrieves API data.
 */
function apiData() {

    const endDate = offsetDate(startDate);
    const limit = 50;

    $.ajax({
        url: endpoint + "?body=Earth&limit=" + limit + "&date-min=" + startDate + "&date-max=" + endDate,
        type: "GET",
        dataType: "json",
        success: function (data) {
            handleData(data, startDate);
        }
    });
}

/**
 * @callback requestCallback
 * @param {Object} data
 */
/**
 * Retrieves the next approach for the given NEO designation.
 * @param {requestCallback} handleNextApproach
 * @param {string} des
 * @param {string} currentApproachDate
 */
function getNextApproach(handleNextApproach, des, currentApproachDate) {

    const startDate = offsetDate(currentApproachDate, 1);
    const endDate = offsetDate(startDate, 3650);

    $.ajax({
        url: endpoint + "?body=Earth&limit=1&des=" + des + "&date-min=" + startDate + "&date-max=" + endDate,
        type: "GET",
        dataType: "json",
        success: function (data) {
            handleNextApproach(data);
        }
    });
}

/**
 * Prepares object data for display.
 * @param {Object} data
 * @param {Array} data.fields
 * @param {Array} data.data
 * @param {string} startDate Format: YYYY-mm-dd
 */
function handleData(data, startDate) {
    const fields = data.fields;
    const results = data.data;

    let allNeos = results.map(function (value, index) {
        let neo = setNeoBaseData(value, fields);
        neo = setNeoAdditionalData(neo, startDate, index);

        return neo;
    });

    console.log(neos);

    neos = allNeos.filter(withinViewingDistance);
    neos.sort((a, b) => a.current_dist_ld - b.current_dist_ld);
    neos.map(setNextApproach);

    console.log(neos);

    draw();
}

/**
 * Draws the SVG canvas and NEOs.
 */
function draw() {
    let svg = document.createElementNS(nsSvg, "svg");
    svg.setAttribute("id", "space");

    const boxWidth = 1000;
    const boxHeight = 4000;

    svg.setAttribute("viewBox", "0 0 " + boxWidth + " " + boxHeight);

    const laneWidth = boxWidth / 10;
    const ldMultiplier = 100;

    neos.forEach(function (neo) {
        let neoObject = drawNeo(neo, svg, laneWidth, ldMultiplier);
        drawTooltipContainer(neo, svg, neoObject);
    });

    drawLdMarkers(svg, ldMultiplier, boxWidth);

    container.append(svg);
}

/** --- DATES -------------------------------------------------------------- **/

/**
 * Formats the given date to YYYY-mm-dd
 * @param {Date} date
 * @returns {string}
 */
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

/**
 * Creates a new date offset from the given date by the given number of days.
 * @param {string} date Format: YYYY-mm-dd
 * @param {number} days
 * @returns {string}
 */
function offsetDate(date, days = 90) {

    const date2 = new Date(date);
    date2.setDate(date2.getDate() + days);

    return dateString(date2);
}

/**
 * Converts calendar date from API format
 * to string date in format YYYY-mm-dd.
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
 * Creates nice textual date from the given date.
 * @param {string} date Format YYYY-mm-dd
 * @returns {string}
 */
function niceDate(date) {

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const dateObject = new Date(date);
    //console.log(dateObject);

    return months[dateObject.getMonth()] + " " + dateObject.getDate();
}

/** --- CREATE NEO --------------------------------------------------------- **/

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
 * @param {number} index
 * @returns {Array}
 */
function setNeoAdditionalData(neo, startDate, index) {

    neo['id'] = index;
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
function withinViewingDistance(neo) {
    return neo['current_dist_ld'] < viewingDistance;
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

function setNextApproach(neo) {

    if (neo['days_to_closest'] > 0) {
        neo['next_approach'] = null;
        return neo;
    }

    getNextApproach(function(nextApproach) {
        if (nextApproach.count > 0) {
            neo['next_approach'] = dateFromCd(nextApproach.data[0][3]);
        }
    }, neo['des'], neo['closest_date']);

    return neo;
}

/** --- DRAWING ------------------------------------------------------------ **/

function drawNeo(neo, parent, laneWidth, ldMultiplier) {

    const neoObject = document.createElementNS(nsSvg, "circle");
    neoObject.setAttribute("id", "neo_" + neo['id']);
    neoObject.setAttribute("class", "neo-object");

    neoObject.setAttribute("cx", (neoXPosition(neo['orbit_id'], laneWidth)).toString());
    neoObject.setAttribute("cy", (neoYPosition(neo['current_dist_ld'], ldMultiplier)).toString());
    neoObject.setAttribute("r", (neoRadius(neo['diameter'])).toString());

    let colour = neoColour(neo['days_to_closest']);
    neoObject.setAttribute("stroke", colour);
    neoObject.setAttribute("fill", colour);

    parent.appendChild(neoObject);

    return neoObject;
}

/**
 * Determine the x position of the object based on its JPL orbit ID.
 * @param {string} orbitId
 * @param {number} laneWidth
 * @returns {number}
 */
function neoXPosition(orbitId, laneWidth) {
    const laneIntervals = 5;
    const laneInterval = laneWidth / laneIntervals;
    const lanePosition = (Math.floor(Math.random() * laneIntervals) + 1) * laneInterval;
    return (orbitalLane(orbitId) * laneWidth) - (lanePosition - (laneInterval / 2))
}

/**
 * Derive a lane in which to display the object from its assigned orbit.
 * @param {string} orbitId
 * @returns {string}
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
function neoYPosition(distance, ldMultiplier) {
    return Math.ceil(distance * ldMultiplier);
}

/**
 * Determine the display radius of the object based on its diameter.
 * @param {number} diameter
 * @returns {number}
 */
function neoRadius(diameter) {

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

function neoColour(daysToClosest) {

    const DEFAULT_COLOUR = "#343a40";

    const grays = [
        {
            "min_ld": 0,
            "max_ld": 1,
            "colour": "#ffffff"
        },
        {
            "min_ld": 1,
            "max_ld": 7,
            "colour": "#adb5bd"
        },
        {
            "min_ld": 7,
            "max_ld": 30,
            "colour": "#6c757d"
        },
        {
            "min_ld": 30,
            "max_ld": 60,
            "colour": "#495057"
        },
        {
            "min_ld": 60,
            "max_ld": null,
            "colour": DEFAULT_COLOUR
        },
    ];

    let colour = DEFAULT_COLOUR;

    let i = 0;
    const count = grays.length;

    for (i; i < count; i++) {

        if (daysToClosest >= grays[i].min_ld
            && (grays[i].max_ld === null || daysToClosest < grays[i].max_ld)
        ) {
            colour = grays[i].colour;
            break;
        }
    }

    return colour;
}

/**
 * Draws Lunar Distance markers.
 * @param {Object} parent The SVG canvas
 * @param {number} ldMultiplier
 * @param {number} boxWidth
 */
function drawLdMarkers(parent, ldMultiplier, boxWidth) {

    [1, 20].forEach(function (distance) {
        let ldMarker = document.createElementNS(nsSvg, "line");
        ldMarker.setAttribute("id", "ld_" + distance);

        ldMarker.setAttribute("x1", "0");
        ldMarker.setAttribute("y1", (ldMultiplier * distance).toString());
        ldMarker.setAttribute("x2", boxWidth.toString());
        ldMarker.setAttribute("y2", (ldMultiplier * distance).toString());

        ldMarker.setAttribute("stroke", "#ffffff");
        ldMarker.setAttribute("stroke-width", "5");
        ldMarker.setAttribute("stroke-dasharray", "10 25");

        parent.appendChild(ldMarker);
    });
}

/**
 * Draws the foreignObject to contain the tooltip.
 * @param {Array} neo
 * @param {Object} parent The SVG canvas
 * @param {Object} neoObject The tooltip's NEO
 */
function drawTooltipContainer(neo, parent, neoObject) {
    const foreign = document.createElementNS(nsSvg, "foreignObject");
    foreign.setAttribute("id", "neo_tooltip_" + neo['id']);
    foreign.setAttribute("class", "tooltip-container");

    const foreignHeight = 180;
    const foreignWidth = 250;

    foreign.setAttribute("x", tooltipXPosition(neoObject, foreignWidth, parent).toString());
    foreign.setAttribute("y", tooltipYPosition(neoObject, foreignHeight).toString());
    foreign.setAttribute("width", foreignWidth.toString());
    foreign.setAttribute("height", foreignHeight.toString());

    drawTooltip(neo, foreign);
    parent.appendChild(foreign);
}

/**
 * Positions the tooltip container either on the left or right side of the NEO
 * so that it does not go off the screen.
 * @param {Object} neoObject The tooltip's NEO
 * @param {number} width
 * @param {Object} parent The SVG canvas
 * @returns {number}
 */
function tooltipXPosition(neoObject, width, parent) {

    const parentWidth = parent.getAttribute("viewBox").split(" ")[2];
    const neoCenter = parseInt(neoObject.getAttribute("cx"));
    const neoRadius = parseInt(neoObject.getAttribute("r"));
    const padding = 20;

    if (neoCenter <= (parentWidth / 2)) {
        return neoCenter + neoRadius + padding;
    }

    return neoCenter - neoRadius - padding - width;
}

/**
 * Positions the tooltip container halfway up the NEO.
 * @param {Object} neoObject The tooltip's NEO
 * @param {number} height
 * @returns {number}
 */
function tooltipYPosition(neoObject, height) {
    const neoCenter = parseInt(neoObject.getAttribute("cy"));
    return neoCenter - (height / 2);
}

/**
 * Draws the tooltip.
 * @param {Array} neo
 * @param {Object} parent The foreignObject container
 */
function drawTooltip(neo, parent) {

    console.log(neo);

    let tooltip = document.createElementNS(nsXhtml, "div");
    tooltip.setAttribute("class", "tooltip-div text-center p-3 sr-only");

    let close = document.createElementNS(nsXhtml, "button");
    close.setAttribute("class", "btn btn-sm btn-dark tooltip-div-close");
    close.appendChild(document.createTextNode("X"));
    tooltip.appendChild(close);

    const tooltipItems = [
        {
            "label": "Object Name",
            "info": neo['des'],
            "id": "des_" + neo['id']
        },
        {
            "label": "Diameter",
            "info": (neo['diameter']).toFixed(1) + "m wide",
            "id": "diameter_" + neo['id']
        },
        {
            "label": "Current Distance",
            "info": (neo['current_dist_ld']).toFixed(1) + " LD away on " + niceDate(startDate),
            "id": "current_" + neo['id']
        },
        {
            "label": "Velocity",
            "info": "Travelling at " + (parseFloat(neo['v_rel'])).toFixed(2) + "km/s",
            "id": "velocity_" + neo['id']
        },
        {
            "label": "Closest Approach",
            "info": "Will reach " + (neo['closest_dist_ld']).toFixed(1) + " LD on " + niceDate(neo['closest_date']),
            "id": "closest_" + neo['id']
        },
        {
            "label": "Next Approach",
            "info": "Will visit again on " + neo['next_approach'] === null ? "N/A" : niceDate(neo['next_approach']),
            "id": "next_" + neo['id']
        }
    ];

    tooltipItems.forEach(function (item, index) {
        let itemDiv = document.createElementNS(nsXhtml, index === 0 ? "h5" : "div");
        drawTooltipItem(item, itemDiv);
        tooltip.appendChild(itemDiv);
    });

    parent.appendChild(tooltip);
}

/**
 * Draws a tooltip item, with a label and information.
 * @param {Object} values
 * @param {Object} parent The tooltip div
 */
function drawTooltipItem(values, parent) {

    let spanLabel = document.createElementNS(nsXhtml, "span");
    spanLabel.setAttribute("id", "tooltip_label_" + values.id);
    spanLabel.setAttribute("class", "sr-only");
    spanLabel.appendChild(document.createTextNode(values.label));

    let spanInfo = document.createElementNS(nsXhtml, "span");
    spanInfo.setAttribute("aria-labelledby", "tooltip_label_" + values.id);
    spanInfo.appendChild(document.createTextNode(values.info));

    parent.appendChild(spanLabel);
    parent.appendChild(spanInfo);
}

/** --- EVENT LISTENERS ---------------------------------------------------- **/

/**
 * Shows and hides the tooltips.
 */
container.on("click", ".neo-object", function () {

    const $this = $(this);
    const key = $this.getKey();

    $this.closest("svg").find(".tooltip-div").each(function () {
        if (! $(this).hasClass("sr-only")) {
            $(this).addClass("sr-only");
        }
    });

    $("#neo_tooltip_" + key).find(".tooltip-div").removeClass("sr-only");
});

/**
 * Hides at tooltip.
 */
container.on("click", ".tooltip-div-close", function () {
    $(this).closest(".tooltip-div").each(function () {
        if (! $(this).hasClass("sr-only")) {
            $(this).addClass("sr-only");
        }
    });
});

/**
 * Gets an object's numerical id.
 * @returns {string|RegExpMatchArray}
 */
$.fn.getKey = function () {

    const keys = this.attr("id").match(/\d+/g);
    const keyCount = keys.length;

    if (keyCount === 1) {
        return keys[0];
    }

    return keys;
};