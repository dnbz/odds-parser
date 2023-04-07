#!/bin/sh

cronn --log.enabled -c "05 * * * * npm run marathon"
