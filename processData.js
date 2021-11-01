const fs = require("fs");
const { csvParse, autoType, csvFormatBody, dsvFormat, parse } = require('d3-dsv');
const { groups } = require('d3-array');
const { flatMap, flat } = require('array-flat-polyfill');

function createTableStatement(table, columns) {
    const reals = ["mean", "uci", "lci"];
    const bigint = ["id"];
    return `CREATE TABLE ${table}(
        ${columns.map(d => `${d} ${reals.includes(d) ? `REAL` : bigint.includes(d) ? `BIGINT` : `SMALLINT`}`).join(",\n")}
    );\n`
}

function createLoadInfileStatement(table) {
    return `LOAD DATA LOCAL INFILE '${table}.csv' INTO TABLE ${table} FIELDS TERMINATED BY ',' LINES TERMINATED BY '\\n';\n`
}

function createIndexStatement(table) {
    return `CREATE UNIQUE INDEX ${table}_id ON ${table}(id);\n
    CREATE INDEX ${table}_year ON ${table}(year);\n
    CREATE INDEX ${table}_where ON ${table}(education,rateOrTotal,fteOrHeadcount,locationType,location,setting);\n`
}



//Note that ids are NOT unique (though they will be for individual scenario tables)
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
    { supply: 'forecastid', demand: 'ForecastID', name: 'scenario' },
    { supply: 'year', demand: 'Year', name: 'year' },
    { supply: 'location', demand: 'Location', name: 'location' },
    { supply: 'type', demand: 'Type', name: 'type' },
    { supply: 'education', demand: '', name: 'education' },
    { supply: 'setting', demand: 'Setting', name: 'setting' }
];

const codeMap = new Map([
    ["rateOrTotal", { rate: 0, total: 1 }],
    ["fteOrHeadcount", { headcount: 0, fte: 1 }]
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
const supply = dsvFormat(";").parse(fs.readFileSync("raw_data/ForecastSummary - V71 -05102021.csv", 'utf8'), autoType)
    .filter(d => d.gender == 0 & d.race == 0 & d.age == 0 & d.year >= 2015 & d.forecastid > 0)
    .flatMap(function (d) {
        const renamedParams = {};
        //First copy over and rename parameters
        parameters.forEach(function (e) {
            renamedParams[e.name] = d[e.supply];
        });
        //Add parameters and reshape data structure
        const newAndRenamedParameters = ["headcount", "fte"].flatMap(function (e) {
            return ["perpop", ""].map(function (f) {
                if (d[e + "" + "mean" + f] === null) {
                    console.log(d)
                }
                // console.log(d[e + "" + "mean" + f])
                const currentFormat = numberFormat(f == "");
                const mean = +currentFormat(d[e + "" + "mean" + f]);
                const uci = +currentFormat(d[e + "" + "uci" + f]);
                const lci = +currentFormat(d[e + "" + "lci" + f]);
                const fteOrHeadcount = codeMap.get("fteOrHeadcount")[e];
                const rateOrTotal = codeMap.get("rateOrTotal")[f == "" ? "total" : "rate"];
                const locationType = getLocationType(d.location);
                return { ...renamedParams, locationType, fteOrHeadcount, rateOrTotal, mean, uci, lci };
            })
        });
        return newAndRenamedParameters;
    }).map(createID);
//Now break up into separate tables
groups(supply, d => d.scenario).forEach(function (d) {
    const sColumns = Object.keys(d[1][0]);
    fs.writeFileSync(`data/supply${d[0]}.csv`, csvFormatBody(d[1], sColumns));
    loadStatement += createTableStatement(`supply${d[0]}`, sColumns);
    loadStatement += createLoadInfileStatement(`supply${d[0]}`);
    loadStatement += createIndexStatement(`supply${d[0]}`);
})


//Load demand data and process - first remove any spaces from headers in csv!
const demand = dsvFormat(",").parse(fs.readFileSync("raw_data/DemandForecast-09082021.csv", 'utf8'), autoType)
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
                const fteOrHeadcount = codeMap.get("fteOrHeadcount")[e.toLowerCase()];
                const rateOrTotal = codeMap.get("rateOrTotal")[f == "" ? "total" : "rate"];
                const locationType = getLocationType(d.Location);
                return { ...renamedParams, locationType, fteOrHeadcount, rateOrTotal, mean };
            })
        });
        return newAndRenamedParameters;
    })
    .map(createID);

//Now break up into separate tables
groups(demand, d => d.scenario).forEach(function (d) {
    const dColumns = Object.keys(d[1][0]);
    fs.writeFileSync(`data/demand${d[0]}.csv`, csvFormatBody(d[1], dColumns));
    loadStatement += createTableStatement(`demand${d[0]}`, dColumns);
    loadStatement += createLoadInfileStatement(`demand${d[0]}`);
    loadStatement += createIndexStatement(`demand${d[0]}`);
});

//.read load_statement.sql
fs.writeFileSync("data/load_statement.sql", loadStatement);

function getLocationType(location) {
    return location < 200 & location != 0 ? 1 : +location.toString().slice(0, 1);

}




