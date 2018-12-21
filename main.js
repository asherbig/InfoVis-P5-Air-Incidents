
window.onload = start;

var svg;
var circleGroup;
var stackedGroup;
var stackedGroup2;
var sim;
var height;
var width;
var margin;

var yScale;
var xScale;
var xAxis;
var yAxis;
var yContainer;
var xContainer;
var xLabel;
var yLabel;

var tip;

//dataset variables
var baseData;
var incidentsByMake;
var incidentsByPhase;
var incidentsByWeather;
var incidentsByCountry;
var incidentsWithSevIndex;

//descriptions
var descriptions = [];
var titleEl;
var descHeadEl;
var descriptionEl;

//states
var state = 0;

function start() {
    // Select the graph from the HTML page and save
    // a reference to it for later.
    var graph = document.getElementById('graph');
    var title = document.getElementById('title');
    var descHeader = document.getElementById('desc-header');
    var description = document.getElementById('description');
    var btnsContainer = document.getElementById('btns-container');

    // Specify the width and height
    margin = {top: 0, right: 0, bottom: 50, left: 40}
    width = 850;
    height = 550;

    titleEl = d3.select(title)
    descHeadEl = d3.select(descHeader);
    descriptionEl = d3.select(description)

    svg = d3.select(graph)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    var restartBtn = d3.select(btnsContainer)
        .append("button")
        .attr("class", "nav-btn animated-button thar-two")
        .text("Restart")
        .on("click", function(d) {restartPage();});
    
    var nextBtn = d3.select(btnsContainer)
        .append("button")
        .attr("class", "nav-btn animated-button thar-two")
        .attr("id", "next-btn")
        .text("Next")
        .on("click", function(d) {
            state++;
            updateToState();
        });

    //get description data
    d3.csv('descriptions.csv', function(d) {
        return d;
    }, function(error, data) {
        descriptions = data;
        //set the default title and description
        titleEl.text(descriptions[state].title);
        descHeadEl.text(descriptions[state].desc_title);
        descriptionEl.text(descriptions[state].description);
    });

    //get the graph data
    d3.csv('aircraft_incidents.csv', function(d) {
        d.Total_Fatal_Injuries = +d.Total_Fatal_Injuries;
        d.Total_Serious_Injuries = +d.Total_Serious_Injuries;
        d.Total_Uninjured = +d.Total_Uninjured;
        d.Event_Date = moment(d.Event_Date, "MM/DD/YY").valueOf();
        return d;
    }, function(error, data) {
        // We now have the "massaged" CSV data in the 'data' variable.
        baseData = data;

        //roll up for the visualizations
        incidentsByMake = d3.nest()
        .key(function(d) { return d.Make; })
        .rollup(function(leaves) {
            return { "total_incidents" : leaves.length,
                "fatal_injuries" : d3.sum(leaves, function(d) { return d.Total_Fatal_Injuries }),
                "serious_injuries" : d3.sum(leaves, function(d) { return d.Total_Serious_Injuries }),
                "uninjured" : d3.sum(leaves, function(d) { return d.Total_Uninjured }),
            };
        })
        .entries(data)
        .map(function(d) { return {"Make": d.key, "Stats": d.value}});

        incidentsByPhase = d3.nest()
        .key(function(d) { return d.Broad_Phase_of_Flight; })
        .rollup(function(leaves) {
            return { "total_incidents" : leaves.length,
                "fatal_injuries" : d3.sum(leaves, function(d) { return d.Total_Fatal_Injuries }),
                "serious_injuries" : d3.sum(leaves, function(d) { return d.Total_Serious_Injuries }),
                "uninjured" : d3.sum(leaves, function(d) { return d.Total_Uninjured }),
            };
        })
        .entries(data)
        .map(function(d) { return {"Phase": d.key, "Stats": d.value}});

        incidentsByWeather = d3.nest()
        .key(function(d) { return d.Weather_Condition; })
        .rollup(function(leaves) {
            return { "total_incidents" : leaves.length,
                "fatal_injuries" : d3.sum(leaves, function(d) { return d.Total_Fatal_Injuries }),
                "serious_injuries" : d3.sum(leaves, function(d) { return d.Total_Serious_Injuries }),
                "uninjured" : d3.sum(leaves, function(d) { return d.Total_Uninjured }),
            };
        })
        .entries(data)
        .map(function(d) { return {"Weather": d.key, "Stats": d.value}});

        incidentsByCountry = d3.nest()
        .key(function(d) { return d.Country; })
        .rollup(function(leaves) {
            return { "total_incidents" : leaves.length,
                "fatal_injuries" : d3.sum(leaves, function(d) { return d.Total_Fatal_Injuries }),
                "serious_injuries" : d3.sum(leaves, function(d) { return d.Total_Serious_Injuries }),
                "uninjured" : d3.sum(leaves, function(d) { return d.Total_Uninjured }),
            };
        })
        .entries(data)
        .map(function(d) { return {"Country": d.key, "Stats": d.value}});

        let incidentsByFatality = d3.nest()
        .key(function(d) { return d.Injury_Severity; })
        .rollup(function(leaves) {
            return { "total_incidents" : leaves.length,
                "fatal_injuries" : d3.sum(leaves, function(d) { return d.Total_Fatal_Injuries }),
                "serious_injuries" : d3.sum(leaves, function(d) { return d.Total_Serious_Injuries }),
                "uninjured" : d3.sum(leaves, function(d) { return d.Total_Uninjured }),
            };
        })
        .entries(data)
        .map(function(d) { return {"Severity": d.key, "Stats": d.value}});

        //sort it so that all the non-injured incidents are at the end
        //(makes the transition to the second vis better)
        baseData = baseData.sort(function(a, b) {
            if (fatalStatus(b) === "Non-Injured" && fatalStatus(a) !== "Non-Injured") {
                return -1;
            }
        });

        let incidentsNoSafe = baseData.filter(function(d) {
            return fatalStatus(d) !== "Non-Injured";
        })

        // console.log("By Severity:", incidentsByFatality);
        // console.log("By Make :", incidentsByMake);
        // console.log("By Phase :", incidentsByPhase);
        // console.log("By Weather :", incidentsByWeather);
        // console.log("By Country :", incidentsByCountry);
        console.log("Base Data:", baseData);

        //give each type of incident an index starting at 0.
        let fatalIndex = 0;
        let nonFatalIndex = 0;
        let otherIndex = 0;
        for (let index in baseData) {
            if (fatalStatus(baseData[index]) === "Fatal") {
                baseData[index].sevIndex = fatalIndex;
                fatalIndex++;
            } else if (fatalStatus(baseData[index]) === "Non-Fatal") {
                baseData[index].sevIndex = nonFatalIndex;
                nonFatalIndex++;
            } else {
                baseData[index].sevIndex = otherIndex;
                otherIndex++;
            }
        }

        //minDate and maxDate store unix number representations of the dates
        var minDate = d3.min(incidentsNoSafe, function(d) { return d.Event_Date });
        var maxDate = d3.max(incidentsNoSafe, function(d) { return d.Event_Date });

        var maxFatalities = d3.max(baseData, function(d) { return d.Total_Fatal_Injuries; });
        var maxInjuries = d3.max(baseData, function(d) { return d.Total_Serious_Injuries; });
        var maxTotal = d3.max(baseData, function(d) { return d.Total_Fatal_Injuries + d.Total_Serious_Injuries; });
        var maxUninjured = d3.max(baseData, function(d) { return d.Total_Uninjured; });

        xScale = d3.scaleLinear().domain([minDate, maxDate]).range([margin.left, width - margin.left]);
        yScale = d3.scaleLinear().domain([0, maxTotal]).range([height - margin.bottom, margin.bottom]);
        
        xAxis = d3.axisBottom(xScale)
            .tickFormat(function(d) { return moment(d).format("YYYY")})
            .ticks(7)

        yAxis = d3.axisLeft(yScale)

        xContainer = svg.append("g") // create a group node
                .attr("transform", "translate(0," + (height - margin.bottom) + ")")
                .attr("class", "x axis")
                .call(xAxis) // call the axis generator
                
        xLabel = xContainer.append("text")
				.attr("class", "label")
				.attr("x", width)
				.attr("y", -8)
                .style("text-anchor", "end")
                .text("Incident Date");
                
        yContainer = svg.append("g") // create a group node
                .attr("transform", "translate("+margin.left+", 0)")
                .attr("class", "y axis")
                .call(yAxis)
                
        yLabel = yContainer.append("text")
				.attr("class", "label")
				.attr("transform", "rotate(-90)")
				.attr("y", 8)
				.attr("dy", ".71em")
				.style("text-anchor", "end")
                .text("Total Fatalities and Injuries Combined");
                
        tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-10, 0])
            .html(function(d) {
                return "Accident: " + d.Accident_Number + "<br/>"
                    + "Date: " + moment(d.Event_Date).format("MM/DD/YYYY") + "<br/>"
                    + "Fatalities: " + d.Total_Fatal_Injuries + "<br/>"
                    + "Injuries: " + d.Total_Serious_Injuries + "<br/>"
                    + "Uninjured: " + d.Total_Uninjured;
        })

        svg.call(tip);

        //make the default visualization, all one byig group of bubbles
        circleGroup = svg.selectAll(".point")
            .data(incidentsNoSafe)
            .enter()
            .append("circle")
            .attr("class", "point")
            .attr("r", 4)
            .attr("cx", function(d) { return xScale(d.Event_Date) })
            .attr("cy", function(d) { return yScale(d.Total_Fatal_Injuries + d.Total_Serious_Injuries) })
            .classed("fatal", function(d) { return fatalStatus(d) === "Fatal" })
            .classed("nonfatal", function(d) { return fatalStatus(d) === "Non-Fatal" })
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide);

    });
}

function fatalStatus(d) {
    // if (d.Injury_Severity === "Non-Fatal" || d.Injury_Severity === "Incident") {
    //     return "Non-Fatal";
    // } else if (d.Injury_Severity === "Unavailable") {
    //     return "Other";
    // } else {
    //     return "Fatal";
    // }
    if (d.Total_Fatal_Injuries > 0) {
        return "Fatal";
    } else if (d.Total_Serious_Injuries > 0) {
        return "Non-Fatal";
    } else {
        return "Non-Injured";
    }
}

function restartPage() {
    console.log("test");
    document.location.reload();
}

function updateToState() {

    titleEl.text(descriptions[state].title);
    descHeadEl.text(descriptions[state].desc_title);
    descriptionEl.text(descriptions[state].description);
    
    if (state === 1) {

        var thickness = 30;
        var r = 3;

        var t = d3.transition()
            .duration(750);

        var xScaleDomain = ["Non-Injured", "Non-Fatal", "Fatal"];
        xScale = d3.scaleBand().domain(xScaleDomain).range([margin.left, width-margin.left], .5);
        xAxis = d3.axisBottom(xScale);
        xContainer.transition(t).call(xAxis);
        xLabel.text("Severity");

        yScale = d3.scaleLinear().domain([0, (height-margin.bottom*2)/(r*2) * thickness]).range([height-margin.bottom, margin.bottom]);
        yAxis = d3.axisLeft(yScale);
        yContainer.transition(t).call(yAxis);
        yLabel.text("Number of Incidents");

        //circle constructed bar graph with incident severity
        let circleGroup = svg.selectAll(".point")
            .data(baseData)
        //don't need to exit, this has all the data in it
        circleGroup
            .classed("fatal", function(d) { return fatalStatus(d) === "Fatal" })
            .classed("nonfatal", function(d) { return fatalStatus(d) === "Non-Fatal" })
            .transition(t)
            .attr("r", r)
            .attr("cx", function(d) { 
                let dx = ((d.sevIndex % thickness) - Math.floor(thickness/2)) * r*2; //move it over radius*2 * how far it is from the center of the stack
                return xScale(fatalStatus(d)) + dx + xScale.step() / 2;
            })
            .attr("cy", function(d) { 
                return height - margin.bottom - Math.floor(d.sevIndex / thickness) * r*2;
            })
        //create new circles if needed
        circleGroup.enter()
            .append("circle")
            .attr("class", "point")
            .attr("opacity", 0)
            .attr("r", r)
            .classed("fatal", function(d) { return fatalStatus(d) === "Fatal" })
            .classed("nonfatal", function(d) { return fatalStatus(d) === "Non-Fatal" })
            .attr("cx", function(d) { 
                let dx = ((d.sevIndex % thickness) - Math.floor(thickness/2)) * r*2; //move it over radius*2 * how far it is from the center of the stack
                return xScale(fatalStatus(d)) + dx  + xScale.step() / 2;
            })
            .attr("cy", 0)
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide)
            .transition(t) //why does this not fade the circles in?
            .attr("opacity", 1)
            .attr("cx", function(d) { 
                let dx = ((d.sevIndex % thickness) - Math.floor(thickness/2)) * r*2; //move it over radius*2 * how far it is from the center of the stack
                return xScale(fatalStatus(d)) + dx  + xScale.step() / 2;
            })
            .attr("cy", function(d) { 
                return height - margin.bottom - Math.floor(d.sevIndex / thickness) * r*2;
            });
            
    } else if (state === 2) {
        //stacked bar graph of fatalities, injuries, and uninjured for each crash

        var t = d3.transition()
            .duration(750);

        //why does this not fade out all the circles?
        let circleGroup = svg.selectAll(".point")
            .data([])
            .exit()./*transition(t).attr("opacity", 0).*/remove();

        //sort by date, since we can't space them exactly by their time
        var incidentsFatal = baseData.filter(function(d) {
            return fatalStatus(d) === "Fatal";
        }).sort(function(a, b) {
            return (a.Event_Date - b.Event_Date);
        })
        
        var dataset = d3.stack().keys(["Total_Fatal_Injuries", "Total_Serious_Injuries", "Total_Uninjured"])(incidentsFatal);

        xScale = d3.scaleLinear()
            .domain([0, dataset[0].length])
            .range([margin.left, width-margin.left]);
        xAxis = d3.axisBottom(xScale)
            .tickFormat(d => {
                return moment(incidentsFatal[d].Event_Date).format("YYYY");
            })
        xContainer.transition(t).call(xAxis);
        xLabel.text("Time ->");

        yScale = d3.scaleLinear()
            .rangeRound([height-margin.bottom, margin.bottom])
            .domain([0, d3.max(dataset, function(d) { 
                return d3.max(d, function(dd) {
                    return dd[1];
                });
            })]);
        yAxis = d3.axisLeft(yScale);
        yContainer.transition(t).call(yAxis);
        yLabel.text("Number of People");
            
        let colorScale = d3.scaleOrdinal()
            .domain(["Total_Fatal_Injuries", "Total_Serious_Injuries", "Total_Uninjured"])
            .range(["#cc0000", "#e6b800", "#83cf1e"]);

        console.log(dataset);

        //new tip information
        tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-10, 0])
            .html(function(d) {
                return "Accident: " + d.data.Accident_Number + "<br/>"
                    + "Date: " + moment(d.data.Event_Date).format("MM/DD/YYYY") + "<br/>"
                    + "Fatalities: " + d.data.Total_Fatal_Injuries + "<br/>"
                    + "Injuries: " + d.data.Total_Serious_Injuries + "<br/>"
                    + "Uninjured: " + d.data.Total_Uninjured;
        })

        stackedGroup = svg.append("g");
        stackedGroup2 = stackedGroup.selectAll("g")
            .data(dataset)
            .enter().append("g")
                .attr("fill", function(d) { console.log(d.key); return colorScale(d.key); });
            
        stackedGroup2.selectAll(".bar")
            .data(function(d) {return d;})
            .enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", function(d, i) { return xScale(i); })
                .attr("y", function(d) { return yScale(d[1]); })
                .attr("opacity", 0)
                .attr("height", 0)
                .attr("width", (width - margin.left*2)/incidentsFatal.length - 1)
                .on('mouseover', tip.show)
                .on('mouseout', tip.hide)
                .transition(t)
                .attr("opacity", 1)
                .attr("height", function(d) { return yScale(d[0]) - yScale(d[1]); })
                .call(tip);

    } else if (state === 3) {
        //scatter plot of non-fatal but injury events.
        //x axis = number of injuries (or date, whichever is better)
        //y axis = percentage of injured people

        var t = d3.transition()
            .duration(750);

        stackedGroup2.selectAll(".bar")
            .data([])
            .exit().transition(t).attr("opacity", 0).remove();

        //create the dataset for the vis. only want non-fatal, injury accidents
        //maybe we want this to be by date? maybe by total injuries
        var incidentsNonFatal = baseData.filter(function(d) {
            return fatalStatus(d) === "Non-Fatal";
        }).sort(function(a, b) {
            return b.Total_Serious_Injuries - a.Total_Serious_Injuries;
        })
        
        var dataset = incidentsNonFatal;
        let minDate = d3.min(dataset, function(d) {return d.Event_Date});
        let maxDate = d3.max(dataset, function(d) {return d.Event_Date});

        xScale = d3.scaleLinear()
            .domain([minDate, maxDate])
            .range([margin.left, width-margin.left]);
        xAxis = d3.axisBottom(xScale)
            .tickFormat(d => {
                return moment(d).format("YYYY");
            })
        xContainer.transition(t).call(xAxis);
        xLabel.text("Time ->");

        yScale = d3.scaleLinear()
            .rangeRound([height-margin.bottom, margin.bottom])
            .domain([0, d3.max(dataset, function(d) {
                return injuredPercentage(d);
            })]);
        yAxis = d3.axisLeft(yScale);
        yContainer.transition(t).call(yAxis);
        yLabel.text("Percentage of Passengers Injured");

        let rScale = d3.scaleLinear()
            .domain([1, d3.max(dataset, function(d) {return d.Total_Serious_Injuries})])
            .range([3, 20]);

        //new tip information
        tip = d3.tip()
            .attr("class", "d3-tip")
            .offset([-10, 0])
            .html(function(d) {
                return "Accident: " + d.Accident_Number + "<br/>"
                    + "Date: " + moment(d.Event_Date).format("MM/DD/YYYY") + "<br/>"
                    + "Injuries: " + d.Total_Serious_Injuries + "<br/>"
                    + "Uninjured: " + d.Total_Uninjured + "<br/>"
                    + "Percent Injured: " + injuredPercentage(d) + "%";
        });

        circleGroup = svg.selectAll(".point")
            .data(dataset)
            .enter()
            .append("circle")
            .attr("class", "point")
            .attr("r", 3)
            .attr("cx", function(d, i) {
                if (i%2 === 1) {
                    return margin.left;
                }
                return width - margin.left;
            })
            .attr("cy", margin.bottom)
            .classed("fatal", function(d) { return fatalStatus(d) === "Fatal" })
            .classed("nonfatal", function(d) { return fatalStatus(d) === "Non-Fatal" })
            .on('mouseover', tip.show)
            .on('mouseout', tip.hide)
            .transition(t.duration(1500))
            .delay(function(d, i) {
                return i * 1.5;
            })
            .attr("r", function (d) {return rScale(d.Total_Serious_Injuries)})
            .attr("cx", function(d) { return xScale(d.Event_Date) })
            .attr("cy", function(d) { return yScale(injuredPercentage(d)) });

        svg.call(tip);

        var nextBtn = document.getElementById('next-btn');
        nextBtn.parentNode.removeChild(nextBtn);

    }
}


function injuredPercentage(d) {
    return Math.ceil(100 * d.Total_Serious_Injuries/(d.Total_Serious_Injuries + d.Total_Uninjured));
}

function makeDataSets() {

}