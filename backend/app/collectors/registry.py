# backend/app/collectors/registry.py
from app.collectors.bizinfo import BizinfoCollector
from app.collectors.kocca import KoccaCollector
from app.collectors.kstartup import KstartupCollector
from app.collectors.smes import SmesCollector
from app.collectors.subsidy24 import Subsidy24Collector

ALL_COLLECTORS = [
    BizinfoCollector(),
    KoccaCollector(),
    KstartupCollector(),
    Subsidy24Collector(),
    SmesCollector(),
]
