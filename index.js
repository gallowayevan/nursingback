const compression = require('compression')
const express = require('express')
const cors = require('cors');
const mysql = require('mysql');

const app = express()
app.use(cors())
app.use(compression())
app.set('port', 8080);

let connectionSettings = {
    connectionLimit: 10,
    host: "localhost",
    user: "nodeapp",
    password: "password",
    port: 3306,
    database: "sampledb"
}

if (process.env.NODE_ENV == "production") {
    connectionSettings = {
        connectionLimit: 10,
        host: process.env.MYSQL_SERVICE_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        port: process.env.MYSQL_SERVICE_PORT,
        database: process.env.MYSQL_DATABASE
    }
}

let db;
try {
    db = mysql.createPool(connectionSettings);
    console.log("Connected to DB")
}
catch (err) {
    console.log(err);
}

let dataID = 0;
app.get('/data/', function (req, res) {
    const { calculation } = req.query;

    if (calculation == "supply" || calculation == "demand") {
        const queryArray = prepareQueryArray(calculation, req.query);
        const scenario = +queryArray.find(d => d[0].includes("Scenario"))[1];
        const queryArrayRenamed = queryArray.filter(d => d[0].indexOf("Scenario") < 0)
            .map(d => [calculation + scenario + "." + d[0], d[1]]);

        db.query(constructQuery(calculation + scenario, queryArrayRenamed), queryArrayRenamed.map(d => d[1]), (error, results, fields) => {
            if (error) {
                return console.error(error.message);
            }

            res.json({ values: results, id: dataID++, params: [["calculation", calculation], ...queryArray] });
        });
    } else if (calculation == "ratio" || calculation == "difference") {


        const queryArray = Object.entries(req.query)
            .map(d => [d[0], +d[1]])
            .filter(d => d[0] != "calculation");
        const scenario = new Map(queryArray.filter(d => d[0].includes("Scenario")).map(d => [d[0].slice(0, 6), d[1]]));
        const queryArrayRenamed = queryArray.filter(d => d[0].indexOf("Scenario") < 0)
            .map(d => [`supply${scenario.get("supply")}.` + d[0], d[1]]);

        const where = queryArrayRenamed.length ?
            "WHERE " + queryArrayRenamed.map(d => `${d[0]} = ?`).join(" AND ") :
            "";

        const sql = `SELECT
                supply${scenario.get("supply")}.year,
                supply${scenario.get("supply")}.location,
                supply${scenario.get("supply")}.setting,
                supply${scenario.get("supply")}.mean supplyMean,
                demand${scenario.get("demand")}.mean demandMean,
                ${calculation == "ratio" ?
                `ROUND(supply${scenario.get("supply")}.mean / demand${scenario.get("demand")}.mean, 3) value` :
                `ROUND(supply${scenario.get("supply")}.mean - demand${scenario.get("demand")}.mean, 3) value`}
            FROM
                supply${scenario.get("supply")}
                INNER JOIN demand${scenario.get("demand")} ON supply${scenario.get("supply")}.id = demand${scenario.get("demand")}.id
            ${where}
            ORDER BY
                supply${scenario.get("supply")}.year`
        db.query(sql, queryArrayRenamed.map(d => d[1]), (error, results, fields) => {
            if (error) {
                return console.error(error.message);
            }
            res.json({ values: results, id: dataID++, params: [["calculation", calculation], ...queryArray] });
        });

    }
}
)

function prepareQueryArray(table, queryObject) {

    const queryArray = Object.entries(queryObject)
        .map(d => [d[0], +d[1]])
        .filter(d => d[0] != "calculation"); //Get rid of calculation because this related to tables not columns

    return queryArray;

}

function renameScenario(scenarioValue, queryArray) {
    return queryArray.map(d => d[0].indexOf("Scenario") > -1 ? ["scenario", scenarioValue] : d);
}

function constructQuery(table, queryArray) {


    const select = `SELECT year, location, setting, mean value ${table.includes("supply") ? ", lci, uci" : ""}`;
    const where = queryArray.length ?
        "WHERE " + queryArray.map(d => `${d[0]} = ?`).join(" AND ") :
        "";
    const orderBy = `ORDER BY year`;
    return `${select} FROM ${table} ${where} ${orderBy};`;
}





app.get('/data/', function (req, res) {
    connection.query(q, function (error, results, fields) {
        if (error) throw error;
        res.json(results);
    });
});


app.listen(app.get('port'), () => console.log(`App listening on port ${app.get('port')} !`))