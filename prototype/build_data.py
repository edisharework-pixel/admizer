"""
엑셀 2개 → HTML 프로토타입에 임베드할 JSON 생성.
- coupang_adreport.xlsx: 광고 보고서 (1,901행)
- coupang gross sales.xlsx: 상품별 판매 데이터 (vendor item metrics)
"""
import openpyxl, json, sys, io
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

BASE = Path(r'C:\Users\cjh78\Documents\애드마이저 광고자료')
AD_XLSX = BASE / 'coupang_adreport.xlsx'
SALES_XLSX = BASE / 'coupang gross sales.xlsx'
OUT_JSON = BASE / 'prototype' / 'data.js'


def pct(v):
    """Parse '0.00%' string or float ratio."""
    if v is None: return 0.0
    if isinstance(v, str):
        v = v.strip().rstrip('%')
        try: return float(v) / 100 if '.' in v or len(v) > 2 else float(v)
        except: return 0.0
    return float(v)


def num(v, default=0):
    if v is None or v == '-' or v == '#DIV/0!' or v == '':
        return default
    try: return float(v)
    except:
        try: return float(str(v).replace(',', ''))
        except: return default


# ---------- 1. 광고 보고서 집계 ----------
print('광고 보고서 로드 중...', file=sys.stderr)
wb = openpyxl.load_workbook(AD_XLSX, data_only=True)
ws = wb['Sheet1']
rows = list(ws.iter_rows(min_row=2, values_only=True))
print(f'  {len(rows):,}행', file=sys.stderr)

# 캠페인 집계 스키마
# key: 캠페인ID
# value: { name, type, start_date, area_breakdown, keywords, totals }

campaigns = {}  # campaign_id -> dict


def _area():
    return {'impressions': 0, 'clicks': 0, 'spend': 0, 'orders': 0, 'qty': 0, 'revenue': 0}


for row in rows:
    (charge, sell_type, ad_type, camp_id, camp_name, ad_group,
     prod_name, opt_id, conv_prod, conv_opt, area, keyword,
     imp, clicks, spend, ctr,
     orders_1, orders_1d, orders_1i, qty_1, qty_1d, qty_1i,
     revenue_1, revenue_1d, revenue_1i,
     orders_14, orders_14d, orders_14i, qty_14, qty_14d, qty_14i,
     revenue_14, revenue_14d, revenue_14i,
     roas_1, roas_1d, roas_1i, roas_14, roas_14d, roas_14i,
     start_date, end_date, note) = row

    if not camp_id:
        continue
    camp_id = int(camp_id)

    if camp_id not in campaigns:
        # 긴 캠페인명 단축 (앞 40자)
        short_name = camp_name
        if short_name and len(short_name) > 40:
            short_name = short_name[:40] + '…'
        campaigns[camp_id] = {
            'id': camp_id,
            'name': camp_name,
            'short_name': short_name,
            'type': ad_type,
            'product': prod_name[:60] if prod_name else '',
            'start_date': str(start_date) if start_date else '',
            'areas': {},
            'total': _area(),
            'keywords': [],
        }

    c = campaigns[camp_id]

    # 영역 분류 단순화
    area_key = '검색' if area and '검색' in area and '비검색' not in area else '비검색'

    # 총 집계 (1일 기준 사용 - 최근일)
    imp_v = num(imp)
    clicks_v = num(clicks)
    spend_v = num(spend)
    orders_v = num(orders_1)
    qty_v = num(qty_1)
    revenue_v = num(revenue_1)

    # 캠페인 total
    for key, val in [('impressions', imp_v), ('clicks', clicks_v), ('spend', spend_v),
                     ('orders', orders_v), ('qty', qty_v), ('revenue', revenue_v)]:
        c['total'][key] = c['total'].get(key, 0) + val

    # 영역별 분해
    if area_key not in c['areas']:
        c['areas'][area_key] = {}
    a = c['areas'][area_key]
    for key, val in [('impressions', imp_v), ('clicks', clicks_v), ('spend', spend_v),
                     ('orders', orders_v), ('qty', qty_v), ('revenue', revenue_v)]:
        a[key] = a.get(key, 0) + val

    # 키워드 추적 (검색 영역만, 키워드 '-' 제외)
    if keyword and keyword != '-' and area_key == '검색' and clicks_v > 0:
        c['keywords'].append({
            'keyword': keyword,
            'area': area_key,
            'impressions': imp_v,
            'clicks': clicks_v,
            'spend': spend_v,
            'orders': orders_v,
            'revenue': revenue_v,
        })


# 파생 지표 계산
def calc_derived(agg):
    """dict with impressions, clicks, spend, orders, qty, revenue → add ctr, cvr, cpc, cpa, roas"""
    agg['ctr'] = (agg['clicks'] / agg['impressions']) if agg['impressions'] else 0
    agg['cvr'] = (agg['orders'] / agg['clicks']) if agg['clicks'] else 0
    agg['cpc'] = (agg['spend'] / agg['clicks']) if agg['clicks'] else 0
    agg['cpa'] = (agg['spend'] / agg['orders']) if agg['orders'] else 0
    agg['roas'] = (agg['revenue'] / agg['spend']) if agg['spend'] else 0
    return agg


for c in campaigns.values():
    calc_derived(c['total'])
    for area_key, a in c['areas'].items():
        calc_derived(a)
    # 키워드 파생
    for k in c['keywords']:
        calc_derived(k)
    # 키워드 상위 20개만 유지 (클릭 기준)
    c['keywords'].sort(key=lambda k: k['clicks'], reverse=True)
    c['keywords'] = c['keywords'][:20]

# ---------- 2. 판매 데이터 집계 ----------
print('판매 데이터 로드 중...', file=sys.stderr)
wb2 = openpyxl.load_workbook(SALES_XLSX, data_only=True, read_only=True)
ws2 = wb2['vendor item metrics']

rows2 = list(ws2.iter_rows(min_row=2, values_only=True))
print(f'  {len(rows2):,}행', file=sys.stderr)

products = []   # 상품별 요약 (최대 50개)
product_totals = {'revenue': 0, 'orders': 0, 'qty': 0}

for row in rows2:
    if len(row) < 20: continue
    (opt_id, opt_name, prod_name, prod_id, category, sell_type,
     rev, orders, qty, cogs, visitors, views, cart, cvr,
     winner_pct, total_rev, total_qty, cancel_amt, cancel_qty, imm_cancel) = row[:20]

    rev_v = num(rev)
    orders_v = num(orders)
    qty_v = num(qty)

    product_totals['revenue'] += rev_v
    product_totals['orders'] += orders_v
    product_totals['qty'] += qty_v

    if rev_v > 0 or orders_v > 0:
        products.append({
            'opt_id': str(opt_id) if opt_id else '',
            'opt_name': (opt_name[:50] + '…') if opt_name and len(opt_name) > 50 else opt_name or '',
            'prod_name': (prod_name[:50] + '…') if prod_name and len(prod_name) > 50 else prod_name or '',
            'category': category or '',
            'revenue': rev_v,
            'orders': orders_v,
            'qty': qty_v,
            'cvr': num(cvr),
            'winner': num(winner_pct),
            'cogs_input': cogs and cogs != '#DIV/0!' and cogs != '0',
        })

products.sort(key=lambda p: p['revenue'], reverse=True)
products = products[:50]
print(f'  상위 상품 {len(products)}개', file=sys.stderr)

# ---------- 3. 룰 엔진 간단 매칭 (21개 케이스) ----------
insights = []

# 전체 광고 집계
all_total = _area()
for c in campaigns.values():
    for k in ['impressions', 'clicks', 'spend', 'orders', 'qty', 'revenue']:
        all_total[k] += c['total'][k]
calc_derived(all_total)


def match_rules(c):
    matched = []
    t = c['total']
    # 데이터 부족 방어
    if t['clicks'] < 50:
        return matched

    # HIGH_CVR_LOW_ROAS - 승자의 저주
    if t['cvr'] > 0.05 and t['roas'] < 3.0:
        matched.append({
            'code': 'HIGH_CVR_LOW_ROAS',
            'name': '승자의 저주',
            'severity': 'critical',
            'priority': 9.2,
            'detail': f"전환율 {t['cvr']*100:.1f}%로 우수하나 ROAS {t['roas']*100:.0f}%로 마진 잠식 가능",
        })
    # LOW_ROAS_HIGH_CTR
    if t['ctr'] > 0.03 and t['roas'] < 3.0 and t['cvr'] >= 0.02:
        matched.append({
            'code': 'LOW_ROAS_HIGH_CTR',
            'name': '고효율 저수익의 역설',
            'severity': 'warning', 'priority': 8.0,
            'detail': f"CTR {t['ctr']*100:.2f}%, ROAS {t['roas']*100:.0f}% — 입찰가 점검 필요",
        })
    # LOW_CTR_LOW_ROAS - 전면 재검토
    if t['ctr'] < 0.005 and t['roas'] < 2.0:
        matched.append({
            'code': 'LOW_CTR_LOW_ROAS',
            'name': '전면 재검토',
            'severity': 'critical', 'priority': 8.8,
            'detail': f"CTR {t['ctr']*100:.2f}%, ROAS {t['roas']*100:.0f}% — 상품·타겟팅 재검토",
        })
    # HIGH_ROAS_LOW_CTR - 숨겨진 보석
    if t['roas'] > 5.0 and t['ctr'] < 0.03 and t['impressions'] > 1000:
        matched.append({
            'code': 'HIGH_ROAS_LOW_CTR',
            'name': '숨겨진 보석',
            'severity': 'info', 'priority': 7.5,
            'detail': f"ROAS {t['roas']*100:.0f}%·CTR {t['ctr']*100:.2f}% — 노출 확대 기회",
        })
    # HIGH_IMP_LOW_CTR - 외면받는 상품
    if t['impressions'] > 10000 and t['ctr'] < 0.003:
        matched.append({
            'code': 'HIGH_IMP_LOW_CTR',
            'name': '외면받는 상품',
            'severity': 'warning', 'priority': 7.8,
            'detail': f"노출 {int(t['impressions']):,}회인데 CTR {t['ctr']*100:.2f}% — 썸네일·가격 점검",
        })
    # LOW_IMP_HIGH_CVR - 우물 안 개구리
    if t['impressions'] < 5000 and t['cvr'] > 0.04:
        matched.append({
            'code': 'LOW_IMP_HIGH_CVR',
            'name': '우물 안 개구리',
            'severity': 'info', 'priority': 6.8,
            'detail': f"CVR {t['cvr']*100:.1f}%·노출 {int(t['impressions']):,}회 — 예산 확대 고려",
        })
    # 비검색 vs 검색 우위
    if '검색' in c['areas'] and '비검색' in c['areas']:
        s_roas = c['areas']['검색']['roas']
        ns_roas = c['areas']['비검색']['roas']
        if ns_roas > s_roas * 1.3 and ns_roas > 3:
            matched.append({
                'code': 'NON_SEARCH_HIGH',
                'name': '비검색 우위',
                'severity': 'info', 'priority': 5.8,
                'detail': f"비검색 ROAS {ns_roas*100:.0f}% > 검색 {s_roas*100:.0f}% — 비검색 가중치↑",
            })
        elif s_roas > ns_roas * 1.3 and s_roas > 3:
            matched.append({
                'code': 'SEARCH_HIGH',
                'name': '검색 우위 (키워드 확장 기회)',
                'severity': 'info', 'priority': 5.5,
                'detail': f"검색 ROAS {s_roas*100:.0f}% > 비검색 {ns_roas*100:.0f}% — 키워드 확장",
            })
    return matched


# 캠페인별 인사이트
for c in campaigns.values():
    for m in match_rules(c):
        insights.append({
            'campaign_id': c['id'],
            'campaign_short': c['short_name'],
            **m
        })

insights.sort(key=lambda i: (-i['priority'], i['severity']))

# ---------- 4. 대시보드용 순위 리스트 ----------
camp_list = list(campaigns.values())

def ranking(key, reverse=True, where=None, area=None, n=3):
    items = camp_list
    if where: items = [c for c in items if where(c)]
    items = sorted(items, key=lambda c: (c['areas'].get(area, {}) if area else c['total']).get(key, 0),
                   reverse=reverse)
    return [{
        'id': c['id'], 'name': c['short_name'],
        'val': (c['areas'].get(area, {}) if area else c['total']).get(key, 0),
    } for c in items[:n]]


rankings = {
    'search_roas_top': ranking('roas', area='검색',
                               where=lambda c: c['areas'].get('검색', {}).get('clicks', 0) > 10),
    'nonsearch_roas_top': ranking('roas', area='비검색',
                                  where=lambda c: c['areas'].get('비검색', {}).get('clicks', 0) > 10),
    'low_roas': ranking('roas', reverse=False,
                        where=lambda c: c['total']['spend'] > 10000 and c['total']['roas'] < 2.5),
    'high_spend': ranking('spend', where=lambda c: True),
    'high_revenue': ranking('revenue', where=lambda c: True),
}

# ---------- 5. 출력 ----------
out = {
    'all_total': all_total,
    'campaigns': sorted(camp_list, key=lambda c: c['total']['spend'], reverse=True),
    'products': products,
    'product_totals': product_totals,
    'insights': insights,
    'rankings': rankings,
    'meta': {
        'generated_at': '2026-04-21',
        'campaign_count': len(campaigns),
        'keyword_rows': sum(len(c['keywords']) for c in camp_list),
        'product_count_total': len(rows2),
    }
}

content = 'window.ADMIZER_DATA = ' + json.dumps(out, ensure_ascii=False, indent=2) + ';\n'
OUT_JSON.write_text(content, encoding='utf-8')

print(f'\n저장 완료: {OUT_JSON}', file=sys.stderr)
print(f'  캠페인 {len(campaigns)}개', file=sys.stderr)
print(f'  인사이트 {len(insights)}건', file=sys.stderr)
print(f'  상위 상품 {len(products)}개', file=sys.stderr)
print(f'  전체 광고비 {all_total["spend"]:,.0f}원', file=sys.stderr)
print(f'  전체 광고매출 {all_total["revenue"]:,.0f}원', file=sys.stderr)
print(f'  전체 ROAS {all_total["roas"]*100:.0f}%', file=sys.stderr)
