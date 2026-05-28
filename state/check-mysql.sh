#!/bin/bash
docker exec docker-mysql mysql -uroot -p147258aA! -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size'; SHOW VARIABLES LIKE 'innodb_log_buffer_size'; SHOW VARIABLES LIKE 'max_connections'; SHOW VARIABLES LIKE 'performance_schema'; SHOW VARIABLES LIKE 'table_open_cache'; SHOW VARIABLES LIKE 'innodb_buffer_pool_instances';"
