#!/bin/sh

# use the proper env file
mv -f ./.env.prod ./.env

# start cron in background
#cron

# touch log so we can watch it
#touch parser.log

# watch the log
cronn --log.enabled -c "30 */2 * * * npm start"
