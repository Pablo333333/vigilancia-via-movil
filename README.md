# Vigilancia de la Vía — Mobile App

Field app for **Vigilancia de la Vía**. People on the road report hazards with a photo and GPS. Operations staff use the same app to take those incidents in hand, close them with evidence, and publish short bulletins. Guests can file a report without creating an account.

The app is a client of the backend API. Status rules, who may close a report, and who may publish a bulletin are enforced there.

## Ways to enter

The welcome screen offers two paths:

- **Empezar** — sign in with email and password. After login the app registers the device for push notifications so a `RESPONSABLE` can be alerted when a new report arrives.
- **Reportar sin registro** — open the public report screen as a guest. The report is stored with no reporter attached.

A guest session only exposes the new-report flow. Map, solutions, bulletins, and statistics stay hidden until someone signs in.

## What each role sees

| Area | Guest | `REPORTANTE` | `RESPONSABLE` | `SUPERVISOR` |
| --- | --- | --- | --- | --- |
| New report | Yes | Yes | Hidden | Yes |
| Map | Hidden | Yes | Yes | Yes |
| Solutions | Hidden | Hidden | Yes, can update | Yes, read only |
| Bulletins | Hidden | Read | Read and publish | Read |
| Statistics | Hidden | Hidden | Full dashboard | Full dashboard |

`REPORTANTE` is the person on the road. `RESPONSABLE` does not file reports from this app; their job is to work the queue. `SUPERVISOR` can still file a report and can inspect the queue, and cannot take an incident or close it.

## Filing a report

The reporter picks one problem type:

| Code | Meaning |
| --- | --- |
| `PIEDRAS_VIA` | Rocks on the road |
| `VIA_SIN_AFIRMADO` | Unsurfaced road |
| `VOLQUETES` | Dump trucks not yielding |
| `MUCHA_PENDIENTE` | Excessive grade |
| `SENALIZACION` | Poor signage |
| `TIEMPO_ESPERA` | Long waiting time |
| `DERRUMBE` | Landslide |
| `CAMBIO_TRAZO` | Alignment change |

They attach a photo from the camera or the gallery, add an optional one-line comment, and send. The app waits for a GPS fix and sends the current latitude and longitude with the report. A report cannot be sent without a location.

The server creates it as `PENDIENTE`. A signed-in user is the reporter. A guest is anonymous. After a successful send, a signed-in user is taken to the map.

### Offline queue

Haul roads often have no signal. If the send fails because the device is offline, the report (type, coordinates, comment, and local photo) is stored on the phone. When connectivity returns, the app uploads the queue in order and marks each item `esOffline` so the server can record that it arrived late. Items that still fail stay in the queue for the next attempt.

## Map

Signed-in users see every report the API allows them to list, plotted so the next person does not file a duplicate of a problem that is already known.

Marker color is the status:

- Red — `PENDIENTE`
- Yellow — `EN_PROCESO`
- Green — `SOLUCIONADO`

Tapping a marker shows the photo, problem type, and comment.

`REPORTANTE` accounts only receive pending and in-progress reports from the shared list, so solved work drops off the map they see. `RESPONSABLE` and `SUPERVISOR` see every status.

## Solutions

This is the operations queue, available to `RESPONSABLE` and `SUPERVISOR`.

The list can be filtered by status and searched by problem type, comment, or status. A summary line counts what is still pending and what is in progress.

A `RESPONSABLE` works an incident in two steps:

1. **Tomar en mano** — moves `PENDIENTE` to `EN_PROCESO`.
2. **Registrar resolución** — moves it to `SOLUCIONADO`, with an optional comment and an evidence photo from the camera or gallery.

A `SUPERVISOR` sees the same list and cannot run those actions. A `REPORTANTE` who reaches the screen is shown an access-restricted message.

## Bulletins

Short notices from operations: restrictions, closures, warnings. Every signed-in user can read them, newest first. When a bulletin includes a restriction duration, it is shown in minutes.

Only `RESPONSABLE` gets the control to publish a new one.

## Statistics

`RESPONSABLE` and `SUPERVISOR` get a dashboard of report volume: counts by status, breakdown by problem type, and a time window of 7 days, 30 days, or all time. The point is to see which problems are recurring and how much of the queue is still open.

The statistics tab is hidden for `REPORTANTE`. The screen behind it, if opened, explains why reporting matters and does not show operational numbers.
