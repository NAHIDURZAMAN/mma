
DROP TABLE BUS_INFO;    

CREATE TABLE BUS_INFO (
    BUS_ID VARCHAR2(100) PRIMARY KEY,
    TOTAL_SEATS NUMBER(3),
    AVAILABLE_SEATS NUMBER(3),
    PER_KM_COST NUMBER(5, 2)
);




