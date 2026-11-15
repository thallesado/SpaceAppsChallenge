"""Live Gemini contract checks; no provider mocking, secrets or raw provider logs."""
import json
from pathlib import Path
import httpx


def main():
    cases = [
        ('coordinates_and_thresholds', 'Analiza exclusivamente las coordenadas latitud -89.5, longitud 0, '
         'desde el 15 de noviembre de 2026, durante un dia, sin buscar otras fechas. '
         'Necesito 4 horas continuas de Sol y Tierra visibles, minimo 30% de luz, minimo 20% de Tierra '
         'visible y maximo 12 horas continuas de oscuridad.'),
        ('unsupported_requirement', 'Busca un alunizaje el 15 de noviembre de 2026 en Mons Malapert. '
         'Es imprescindible garantizar que consumire menos de 100 kg de combustible durante el descenso. '
         'Si no puedes calcularlo, pide aclaracion; no lo sustituyas por iluminacion.'),
        ('excessive_period', 'Compara Mons Mouton y Mons Malapert todos los dias durante 90 dias '
         'desde el 15 de noviembre de 2026. No reduzcas el periodo sin preguntarme.'),
    ]
    report = {'provider': 'Live authenticated Gemini', 'mocked': False, 'cases': []}
    with httpx.Client(base_url='http://127.0.0.1:8000', timeout=120) as client:
        for name, text in cases:
            response = client.post('/api/v1/assistant/plan', json={'text': text, 'reference_date': '2026-11-15'})
            assert response.status_code == 200, f'{name}: HTTP {response.status_code}'
            plan = response.json()['plan']
            if name == 'coordinates_and_thresholds':
                assert not plan['clarification'], plan['clarification']
                assert not plan['site_ids'] and len(plan['coordinates']) == 1
                assert plan['coordinates'][0]['latitude_deg'] == -89.5
                assert plan['coordinates'][0]['longitude_deg'] == 0
                assert plan['start_date'] == '2026-11-15'
                assert plan['duration_days'] == 1 and plan['search_days'] == 0
                c = plan['constraints']
                assert c['min_concurrent_hours'] == 4 and c['min_sunlit_fraction'] == .3
                assert c['min_earth_visible_fraction'] == .2 and c['max_darkness_hours'] == 12
                result = client.post('/api/v1/assistant/search', json=plan)
                assert result.status_code == 200
                data = result.json()
                assert len(data['options']) == 1 and not data['unavailable']
                assert data['options'][0]['result']['scenario']['constraints']['max_darkness_hours'] == 12
            else:
                assert plan['clarification'], f'{name}: missing clarification'
                assert client.post('/api/v1/assistant/search', json=plan).status_code == 422
            report['cases'].append({'name': name, 'passed': True, 'plan': plan})
            print(name, 'PASS', flush=True)
    target = Path(__file__).resolve().parents[2] / 'docs/VALIDACION_ASISTENTE_REAL.json'
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
