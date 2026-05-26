# Log alert example (pseudo)
# Search for JSON lines with event=db_error and ETIMEDOUT/P1001
# Example with grep for local logs
# grep -r '"event":"db_error"' ./logs | grep -E 'ETIMEDOUT|P1001'

# Datadog/ELK: create an alert on query: event:db_error AND (message:ETIMEDOUT OR prismaCode:P1001)
# Action: page on-call and create a ticket
