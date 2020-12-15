const fs = require("fs");
const { csvParse, autoType, csvFormatBody, dsvFormat, parse } = require('d3-dsv');
const { flatMap, flat } = require('array-flat-polyfill');

function createTableStatement(table, columns) {
    const reals = ["mean", "uci", "lci"];
    const texts = [];
    return `CREATE TABLE ${table}(
        ${columns.map(d => `${d} ${reals.includes(d) ? `REAL` : texts.includes(d) ? `TEXT` : `INTEGER`}`).join(",\n")}
    );`
}

//Note that ids are NOT unique
//They are a convenience for quickly joining observations from the supply
//and demand tables that have the same parameter settings (excluding scenario)
function createID(d) {
    const doNotIncludeInID = ["mean", "uci", "lci", "scenario"];

    d.id = +Object.entries(d).map(function ([key, value]) {

        if (key == "locationType") {
            return value.toString().padStart(3, "0")
        } else if (doNotIncludeInID.includes(key)) {
            return "";
        } else {
            return value;
        }
    }).join("");
    return d;
}

let loadStatement = "";

const parameters = [
    { supply: 'Forecast ID', demand: 'ForecastID', name: 'scenario' },
    { supply: 'Year', demand: 'Year', name: 'year' },
    { supply: 'Location', demand: 'Location', name: 'location' },
    { supply: 'Type', demand: 'Type', name: 'type' },
    { supply: 'Education', demand: '', name: 'education' },
    { supply: 'Setting', demand: 'Setting', name: 'setting' }
];

const codeMap = new Map([
    ["rateOrTotal", { rate: 0, total: 1 }],
    ["fteOrHeadcount", { Headcount: 0, FTE: 1 }]
]
);

function numberFormat(total = 1) {
    return v =>
        total
            ? Math.round(v)
            : v.toLocaleString(undefined, {
                useGrouping: false,
                minimumSignificantDigits: 3,
                maximumSignificantDigits: 3
            });
}

//Load supply data and process - first remove any spaces from headers in csv!
const supply = csvParse(fs.readFileSync("raw_data/ForecastSummary - V41 -02122020.csv", 'utf8'), autoType)
    .filter(d => d.Gender == 0 & d.Race == 0 & d.Age == 0 & d.Year >= 2015)
    .flatMap(function (d) {
        const renamedParams = {};
        //First copy over and rename parameters
        parameters.forEach(function (e) {
            renamedParams[e.name] = d[e.supply];
        });
        //Add parameters and reshape data structure
        const newAndRenamedParameters = ["Headcount", "FTE"].flatMap(function (e) {
            return [" per pop", ""].map(function (f) {
                const currentFormat = numberFormat(f == "");
                const mean = +currentFormat(d[e + " " + "mean" + f]);
                const uci = +currentFormat(d[e + " " + "UCI" + f]);
                const lci = +currentFormat(d[e + " " + "LCI" + f]);
                const fteOrHeadcount = codeMap.get("fteOrHeadcount")[e];
                const rateOrTotal = codeMap.get("rateOrTotal")[f == "" ? "total" : "rate"];
                const locationType = getLocationType(d.Location);
                return { ...renamedParams, locationType, fteOrHeadcount, rateOrTotal, mean, uci, lci };
            })
        });
        return newAndRenamedParameters;
    }).map(createID);
const sColumns = Object.keys(supply[0]);
fs.writeFileSync("raw_data/supply_long.csv", csvFormatBody(supply, sColumns));
loadStatement += createTableStatement("supply", sColumns);

//Load demand data and process - first remove any spaces from headers in csv!
const demand = dsvFormat(";").parse(fs.readFileSync("raw_data/DemandForecastSummary-10112020.csv", 'utf8'), autoType)
    .flatMap(function (d) {
        const renamedParams = {};
        //First copy over and rename parameters
        parameters.forEach(function (e) {
            if (e.demand) {
                renamedParams[e.name] = d[e.demand];
            } else {
                renamedParams[e.name] = 0; //Education and Nurse Type get set to All.
            }
        });
        //Add parameters and reshape data structure
        const newAndRenamedParameters = ["Headcount", "FTE"].flatMap(function (e) {
            return ["perPop", ""].map(function (f) {
                const currentFormat = numberFormat(f == "");
                const mean = +currentFormat(d[e + "Demand" + f]);
                const fteOrHeadcount = codeMap.get("fteOrHeadcount")[e];
                const rateOrTotal = codeMap.get("rateOrTotal")[f == "" ? "total" : "rate"];
                const locationType = getLocationType(d.Location);
                return { ...renamedParams, locationType, fteOrHeadcount, rateOrTotal, mean };
            })
        });
        return newAndRenamedParameters;
    })
    .map(createID);
const dColumns = Object.keys(demand[0]);
fs.writeFileSync("raw_data/demand_long.csv", csvFormatBody(demand, dColumns));
loadStatement += "\n" + createTableStatement("demand", dColumns);

//.read load_statement.sql
fs.writeFileSync("raw_data/load_statement.sql", loadStatement);

function getLocationType(location) {
    return location < 200 & location != 0 ? 1 : +location.toString().slice(0, 1);

}




