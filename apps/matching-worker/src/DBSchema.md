| table_schema | table_name | column_name   | data_type                   | is_nullable | column_default | character_maximum_length | numeric_precision | numeric_scale |
| ------------ | ---------- | ------------- | --------------------------- | ----------- | -------------- | ------------------------ | ----------------- | ------------- |
| public       | Car        | id            | bigint                      | NO          | null           | null                     | 64                | 0             |
| public       | Car        | user_id       | text                        | YES         | null           | null                     | null              | null          |
| public       | Car        | make          | text                        | YES         | null           | null                     | null              | null          |
| public       | Car        | model         | text                        | YES         | null           | null                     | null              | null          |
| public       | Car        | color         | text                        | YES         | null           | null                     | null              | null          |
| public       | Car        | license_plate | text                        | YES         | null           | null                     | null              | null          |
| public       | Car        | capacity      | smallint                    | YES         | null           | null                     | 16                | 0             |
| public       | Car        | created_at    | timestamp without time zone | NO          | now()          | null                     | null              | null          |
| public       | Rides      | id            | bigint                      | NO          | null           | null                     | 64                | 0             |
| public       | Rides      | driver_id     | text                        | YES         | null           | null                     | null              | null          |
| public       | Rides      | rider_id      | text                        | YES         | null           | null                     | null              | null          |
| public       | Rides      | ride_date     | date                        | YES         | null           | null                     | null              | null          |
| public       | Rides      | start_time    | time without time zone      | YES         | null           | null                     | null              | null          |
| public       | Rides      | location      | text                        | YES         | null           | null                     | null              | null          |
| public       | Rides      | status        | text                        | YES         | null           | null                     | null              | null          |
| public       | Rides      | created_at    | timestamp without time zone | NO          | now()          | null                     | null              | null          |
| public       | User       | id            | text                        | NO          | null           | null                     | null              | null          |
| public       | User       | name          | text                        | YES         | null           | null                     | null              | null          |
| public       | User       | residence     | text                        | YES         | null           | null                     | null              | null          |
| public       | User       | picture_url   | text                        | YES         | null           | null                     | null              | null          |
| public       | User       | is_driver     | boolean                     | YES         | null           | null                     | null              | null          |
| public       | User       | created_at    | timestamp without time zone | NO          | now()          | null                     | null              | null          |
| public       | schedule   | id            | bigint                      | NO          | null           | null                     | 64                | 0             |
| public       | schedule   | user_id       | text                        | YES         | null           | null                     | null              | null          |
| public       | schedule   | is_driver     | boolean                     | YES         | null           | null                     | null              | null          |
| public       | schedule   | days          | json                        | YES         | null           | null                     | null              | null          |
| public       | schedule   | pickup_loc    | text                        | YES         | null           | null                     | null              | null          |
| public       | schedule   | dropoff_loc   | text                        | YES         | null           | null                     | null              | null          |
| public       | schedule   | created_at    | timestamp without time zone | NO          | now()          | null                     | null              | null          |