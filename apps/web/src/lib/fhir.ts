// FHIR R4 bundle of body weight and height observations, shaped after the SATUSEHAT
// Observation profile. Prototype only: identifiers, organisation and patient references must be
// mapped to real SATUSEHAT ids before any upload, and the format is not verified against the
// SATUSEHAT validator yet.
import type { ChildSummary } from '@growsense/core'

const LOINC = 'http://loinc.org'

function observation(
  id: string,
  patient: string,
  date: string,
  code: string,
  display: string,
  value: number,
  unit: string,
  ucum: string,
) {
  return {
    fullUrl: `urn:uuid:${id}`,
    resource: {
      resourceType: 'Observation',
      id,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: { coding: [{ system: LOINC, code, display }] },
      subject: { reference: `Patient/${patient}` },
      effectiveDateTime: date,
      valueQuantity: { value, unit, system: 'http://unitsofmeasure.org', code: ucum },
    },
    request: { method: 'POST', url: 'Observation' },
  }
}

export function fhirBundle(list: ChildSummary[], month: string) {
  const entry = []
  for (const s of list) {
    const patient = s.child.nik ? `nik-${s.child.nik}` : `growsense-${s.child.id}`
    for (const m of s.measurements.filter((m) => m.measured_at.startsWith(month))) {
      if (m.weight_kg !== null)
        entry.push(
          observation(crypto.randomUUID(), patient, m.measured_at, '29463-7', 'Body weight', m.weight_kg, 'kg', 'kg'),
        )
      if (m.height_cm !== null) {
        const lying = m.position === 'recumbent'
        entry.push(
          observation(
            crypto.randomUUID(),
            patient,
            m.measured_at,
            lying ? '8306-3' : '8302-2',
            lying ? 'Body height --lying' : 'Body height',
            m.height_cm,
            'cm',
            'cm',
          ),
        )
      }
    }
  }
  return { resourceType: 'Bundle', type: 'transaction', entry }
}
