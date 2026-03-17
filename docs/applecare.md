# AppleCare Integration

HAM fetches AppleCare and warranty status for each device from Apple's warranty API during ABM sync.

## Fields populated

| Field | Description |
|---|---|
| `applecare_status` | Coverage status (e.g. `Active`, `Expired`) |
| `applecare_description` | Plan name (e.g. `AppleCare+ for Mac`) |
| `applecare_start_date` | Coverage start |
| `applecare_end_date` | Coverage end |
| `applecare_agreement_number` | AppleCare agreement number |
| `applecare_is_renewable` | Whether the plan is renewable |
| `applecare_payment_type` | Payment type (e.g. `Upfront`, `Monthly`) |

## Rate limiting

Apple's warranty API rate-limits requests. HAM handles this with configurable concurrency and exponential backoff:

```env
APPLECARE_CONCURRENCY=2
```

Reduce to 1 if you continue to see 429 errors, especially in cloud deployments where API calls are faster.

## Troubleshooting

- **No AppleCare data**: ensure ABM sync is running successfully first — AppleCare lookup is Phase 2 of ABM sync
- **429 errors**: reduce `APPLECARE_CONCURRENCY`
- **Some devices missing**: Apple's API may not have data for all serial numbers
