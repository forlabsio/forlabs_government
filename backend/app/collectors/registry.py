# backend/app/collectors/registry.py
# BizinfoCollector removed: bizinfo.go.kr blocks non-Korean IPs (Railway AWS)
from app.collectors.kocca import KoccaCollector
from app.collectors.kstartup import KstartupCollector
from app.collectors.smes import SmesCollector
from app.collectors.subsidy24 import Subsidy24Collector

ALL_COLLECTORS = [
    KoccaCollector(),
    KstartupCollector(),
    Subsidy24Collector(),
    SmesCollector(),
]
