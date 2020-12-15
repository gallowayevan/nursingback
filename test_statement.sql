SELECT
    supply32.year,
    supply32.location,
    supply32.setting,
    supply32.mean supplyMean,
    demand1.mean demandMean,
    ROUND(supply32.mean - demand1.mean, 3) value
FROM
    supply32
    INNER JOIN demand1 ON supply32.id = demand1.id
WHERE
    supply32.type = 2
    AND supply32.education = 0
    AND supply32.rateOrTotal = 1
    AND supply32.fteOrHeadcount = 0
    AND supply32.locationType = 8
    AND supply32.location = 801
    AND supply32.setting = 0
ORDER BY
    supply32.year;