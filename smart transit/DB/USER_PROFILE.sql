
DROP TABLE USER_PROFILE FORCE;
DROP SEQUENCE user_id_seq;
DROP TRIGGER user_id_trigger;
DROP TRIGGER user_age_trigger;

CREATE SEQUENCE user_id_seq
START WITH 1
INCREMENT BY 1
NOCACHE;


CREATE TABLE USER_PROFILE (
    USER_ID VARCHAR2(20) PRIMARY KEY,
    NAME VARCHAR2(100) NOT NULL,
    EMAIL VARCHAR2(100) UNIQUE NOT NULL,
    PHONE VARCHAR2(20),
    CARD_ID VARCHAR2(50) UNIQUE NOT NULL,
    BALANCE NUMBER(10, 2) NOT NULL,
    DOB TIMESTAMP NOT NULL,
    PASSWORD VARCHAR2(100) NOT NULL,  -- Changed 'PASSWORD' to 'PASSWORD_HASH'
    AGE NUMBER(3), -- Age will be calculated based on DOB
    ADDRESS VARCHAR2(200) NOT NULL
);



-- Trigger to generate USER_ID


CREATE OR REPLACE TRIGGER user_id_trigger
BEFORE INSERT ON USER_PROFILE
FOR EACH ROW
WHEN (NEW.USER_ID IS NULL)
BEGIN
  :NEW.USER_ID := 'U' || LPAD(user_id_seq.NEXTVAL, 6, '0');
END;
/


CREATE OR REPLACE TRIGGER user_age_trigger
BEFORE INSERT OR UPDATE ON USER_PROFILE
FOR EACH ROW
BEGIN
  :NEW.AGE := FLOOR(MONTHS_BETWEEN(SYSDATE, :NEW.DOB) / 12);
END;
/

-- Insert 1st User (without specifying USER_ID)
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD)
VALUES ('John Doe', 'john.doe@example.com', '+123456789', '520028A3A0', 500, TO_TIMESTAMP('1996-04-12 10:00:00', 'YYYY-MM-DD HH24:MI:SS'), '123 Street, City, Country', 'hashed_password');

-- Insert 2nd User
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD)
VALUES ('Jane Smith', 'jane.smith@example.com', '+987654321', '520028B840', 1000, TO_TIMESTAMP('1992-05-15 09:30:00', 'YYYY-MM-DD HH24:MI:SS'), '456 Avenue, Town, Country', 'hashed_password');

-- Insert 3rd User with unique data
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD)
VALUES ('Mike Johnson', 'mike.johnson@example.com', '+1122334450', '520026D872', 750, TO_TIMESTAMP('1998-02-22 08:15:00', 'YYYY-MM-DD HH24:MI:SS'), '789 Boulevard, City, Country', 'hashed_password');

-- Insert 4th User with unique data
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD)
VALUES ('Chris Johnson', 'chris.johnson@example.com', '+1122334460', '520028E289', 750, TO_TIMESTAMP('1995-01-10 08:30:00', 'YYYY-MM-DD HH24:MI:SS'), '789 Boulevard, City, Country', 'hashed_password');

-- Insert 5th User with unique data
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD)
VALUES ('Alex Johnson', 'alex.johnson@example.com', '+1122334470', '4400309616', 750, TO_TIMESTAMP('1997-03-05 10:15:00', 'YYYY-MM-DD HH24:MI:SS'), '789 Boulevard, City, Country', 'hashed_password');
