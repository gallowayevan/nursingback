CREATE TABLE demand1 AS SELECT * FROM demand WHERE scenario = 1;
CREATE TABLE supply32 AS SELECT * FROM supply WHERE scenario = 32;
CREATE TABLE supply33 AS SELECT * FROM supply WHERE scenario = 33;
CREATE TABLE supply35 AS SELECT * FROM supply WHERE scenario = 35;
CREATE TABLE supply40 AS SELECT * FROM supply WHERE scenario = 40;
CREATE TABLE supply41 AS SELECT * FROM supply WHERE scenario = 41;

CREATE UNIQUE INDEX demand1_id ON demand1(id);
CREATE UNIQUE INDEX supply32_id ON supply32(id);
CREATE UNIQUE INDEX supply33_id ON supply33(id);
CREATE UNIQUE INDEX supply35_id ON supply35(id);
CREATE UNIQUE INDEX supply40_id ON supply40(id);
CREATE UNIQUE INDEX supply41_id ON supply41(id);

DROP TABLE supply;
DROP TABLE demand;

