--users table
CREATE TABLE users (
	id serial PRIMARY KEY,
	name varchar(512) not null,
	email varchar(512) not null,
	password varchar(1024) not null
);

--events table
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

--DROP TABLE events;
CREATE TABLE events
(
	id VARCHAR(128) NOT NULL,
	name varchar(2048) not null,
	segment varchar(128),
	genre varchar(128),
	startTime varchar(128),
	startDate varchar(128),
	images varchar(1024),
	url varchar(1024),
	venue varchar(2048),
	distance varchar(128),
	address varchar(256),
	city varchar(128),
	state varchar(128),
	lat DECIMAL(11,8),
    lng DECIMAL(11,8),
	parking varchar(4098),
	priceRange varchar(512),
	postalCode varchar(64),
	userId bigint,
	timestamp TIMESTAMP
);

CREATE INDEX latlng_index ON events USING gist (ll_to_earth(lat, lng));

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO abhatta;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO abhatta;




