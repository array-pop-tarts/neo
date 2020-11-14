# Near-Earth Objects (neo)

A visualization of NASA-JPL's monitoring of asteroids and comets that approach Earth, retrieved through their API: https://ssd-api.jpl.nasa.gov/doc/cad.html

Visual settings, such as the lunar-distance-based layout and the relative sizes of the visualized NEOs are based on information about the kinds of data that JPL considers important with respect to distances and sizes and threat levels of NEOs. The basic research was done from https://cneos.jpl.nasa.gov/about/neo_groups.html as well as from the Imperial College London Earth Impact Effects Program at https://impact.ese.ic.ac.uk/ImpactEarth/ImpactEffects/.

## Author

Barbara Goss
500427370

## Technologies

jQuery was used to make calls to the API to retrieve the data in JSON format.

This was then processed with JavaScript calculations to be more usable for the visualization.

JavaScript was then used to generate SVG objects to load into the HTML page.

CSS was generated from Bootstrap SCSS using a modified 24-column grid.

Organizing data and creating calculations in the planning and design stage was done in Excel, with JSON converted to CSV format using the website [https://json-csv.com/].

The design of the visualization was the hardest part for me, and I used the totally analogue technology of pencil, ruler and paper to try out different scales of layouts and sizes of the NEOs to get a meaningful visual interpretation of the tabular data.

## Technical Issues

I had to remove a feature that would do a second API call for any NEOs that are on closest approach today to see when they would next return on their orbits. Because the call is asynchronous, I could not assign the value returned by the call to the NEO in the parent function. I left the code commented out.

SVG objects are drawn in a stack in the order they appear in the code, so later items stack on top of earlier items. I could not find a way to control the z-index or similar property, so the invisible tooltips of some NEOs cover up other NEOs that are close-by and make it impossible to click on them to see their tooltips. Conversley, some later NEOs show up on top of the visible tooltip of an earlier NEO that is close-by.