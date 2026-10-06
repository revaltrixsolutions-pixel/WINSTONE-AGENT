# Backend

## Automatic appointment WhatsApp notifications

When an appointment is created through the patient WhatsApp booking flow or
the admin appointment form, the backend sends the appointment details to
`0708130100` using the WhatsApp Cloud API. Notification failures are logged
and reported to the admin form; they do not undo a saved appointment.

The notification uses an approved WhatsApp message template because the
hospital number may not have an active 24-hour service window with the
business. By default, configure an approved template named
`appointment_notification`, in language `en`, with one body text placeholder:

```text
New appointment details:
{{1}}
```

The backend passes the patient name and phone, service, clinician, appointment
date/time, listed fee, status, and reference together as that one body
parameter. If the approved template uses a different name or language, set
`WHATSAPP_APPOINTMENT_TEMPLATE` and `WHATSAPP_APPOINTMENT_TEMPLATE_LANGUAGE`.
The WhatsApp Cloud API credentials (`WHATSAPP_ACCESS_TOKEN` and
`WHATSAPP_PHONE_NUMBER_ID`) must also be configured, and the destination
number must be eligible to receive messages from the business.

With `WHATSAPP_SIMULATE=true`, the backend records the simulated notification
in its logs but does not deliver it.
