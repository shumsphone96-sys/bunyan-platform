from flask import Flask,request,redirect,session,render_template_string,flash,send_from_directory,url_for
import sqlite3,os,secrets,uuid
from datetime import timedelta,datetime
from werkzeug.security import generate_password_hash,check_password_hash
from werkzeug.utils import secure_filename

BASE='/opt/wadnofei-membership'
DB=os.path.join(BASE,'members.db')
UPLOADS=os.path.join(BASE,'uploads')
QRS=os.path.join(BASE,'qrs')
SECRET_FILE=os.path.join(BASE,'.secret')
os.makedirs(BASE,exist_ok=True); os.makedirs(UPLOADS,exist_ok=True); os.makedirs(QRS,exist_ok=True)
if not os.path.exists(SECRET_FILE):
    with open(SECRET_FILE,'w') as f: f.write(secrets.token_hex(32))
    os.chmod(SECRET_FILE,0o600)
with open(SECRET_FILE) as f: SECRET=f.read().strip()

app=Flask(__name__)
app.secret_key=SECRET
app.permanent_session_lifetime=timedelta(hours=8)
app.config.update(SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE='Lax',SESSION_COOKIE_SECURE=True,MAX_CONTENT_LENGTH=4*1024*1024)

def db():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c

def addcol(c,table,col,definition):
    cols={r['name'] for r in c.execute(f'PRAGMA table_info({table})')}
    if col not in cols: c.execute(f'ALTER TABLE {table} ADD COLUMN {col} {definition}')

def init():
    c=db()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT,role TEXT DEFAULT 'admin');
    CREATE TABLE IF NOT EXISTS applications(id INTEGER PRIMARY KEY AUTOINCREMENT,app_no TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,address TEXT,dob TEXT,job TEXT,member_type TEXT,notes TEXT,photo TEXT,status TEXT DEFAULT 'pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT,review_note TEXT,member_id INTEGER);
    CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT,member_no TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,address TEXT,status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP,dob TEXT,job TEXT,member_type TEXT,notes TEXT,photo TEXT,qr_token TEXT UNIQUE,approved_at TEXT);
    CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER,amount REAL,receipt TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,kind TEXT DEFAULT 'اشتراك عضوية',period TEXT);
    ''')
    addcol(c,'users','role',"TEXT DEFAULT 'admin'")
    for col,definition in [('dob','TEXT'),('job','TEXT'),('member_type','TEXT'),('notes','TEXT'),('photo','TEXT'),('qr_token','TEXT'),('approved_at','TEXT')]: addcol(c,'members',col,definition)
    for col,definition in [('kind',"TEXT DEFAULT 'اشتراك عضوية'"),('period','TEXT')]: addcol(c,'payments',col,definition)
    if not c.execute('SELECT 1 FROM users').fetchone(): c.execute('INSERT INTO users(username,password,role) VALUES(?,?,?)',('admin',generate_password_hash('ChangeMe123!'),'admin'))
    c.commit(); c.close()
init()

STYLE='''<style>
:root{--b:#234890;--g:#d8ae43;--bg:#f5f7fb;--line:#dce4ef;--ok:#137a4b;--bad:#a22c2c}*{box-sizing:border-box}body{font-family:Tahoma,Arial;background:var(--bg);margin:0;color:#172033}header{background:linear-gradient(135deg,#234890,#17366f);color:#fff;padding:22px 16px;border-bottom:5px solid var(--g)}header .x,main{max-width:1100px;margin:auto}header h1{margin:0 0 5px;font-size:26px}header small{opacity:.9}main{padding:14px}.card,.stat{background:#fff;border:1px solid var(--line);padding:15px;border-radius:16px;margin:11px 0;box-shadow:0 3px 12px #17366f0a}.nav{display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;z-index:4}.nav a,.btn,button{display:inline-block;padding:10px 13px;border-radius:10px;text-decoration:none;border:0;font:inherit;cursor:pointer}.nav a,.btn{background:#fff;border:1px solid var(--line);color:var(--b)}button,.primary{background:var(--b)!important;color:#fff!important}.gold{background:var(--g)!important;color:#172033!important}.danger{background:#a22c2c!important;color:#fff!important}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.stat b{font-size:25px;display:block;margin-top:5px}.form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form label{font-weight:bold}input,select,textarea{width:100%;padding:11px;border:1px solid #cfd8e5;border-radius:9px;margin-top:5px;font:inherit;background:#fff}.full{grid-column:1/-1}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.flash{background:#fff2c7;padding:10px;border-radius:9px;margin:10px 0}.badge{background:#edf2fa;padding:5px 9px;border-radius:20px}.ok{color:var(--ok)}.bad{color:var(--bad)}.muted{color:#667085}.member-card{background:linear-gradient(135deg,#234890,#17366f);color:#fff;border:3px solid var(--g);max-width:560px;position:relative;overflow:hidden}.member-card:after{content:'';position:absolute;width:190px;height:190px;border:24px solid #ffffff12;border-radius:50%;left:-70px;bottom:-90px}.card-row{display:flex;gap:16px;align-items:center}.photo{width:92px;height:105px;object-fit:cover;border-radius:12px;border:3px solid #fff;background:#eef2f7}.qr{width:110px;background:white;padding:5px;border-radius:8px}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.kpi-title{font-size:14px;color:#667085}.section-title{margin:0 0 10px}.pill{padding:5px 9px;border-radius:20px;background:#f0f4fb}.print-only{display:none}@media(max-width:700px){header h1{font-size:23px}.grid{grid-template-columns:1fr 1fr}.form{grid-template-columns:1fr}.full{grid-column:1}.card-row{align-items:flex-start}.nav{position:static}.member-card{max-width:100%}}@media(max-width:430px){.grid{grid-template-columns:1fr 1fr}.stat{padding:12px}.stat b{font-size:22px}.nav a{flex:1;text-align:center}.card-row{flex-direction:column}.photo{width:82px;height:94px}}@media print{header,.nav,.no-print,.flash{display:none!important}body{background:white}.member-card{box-shadow:none;margin:0 auto;width:86mm;min-height:54mm}.print-only{display:block}}
</style>'''
PAGE='''<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>عضوية نادي ود نفيع</title>'''+STYLE+'''</head><body><header><div class="x"><h1>نادي ود نفيع الرياضي الثقافي الاجتماعي</h1><small>نظام العضوية المركزي — تأسس عام 1964</small></div></header><main>{% with ms=get_flashed_messages() %}{% for m in ms %}<div class="flash">{{m}}</div>{% endfor %}{% endwith %}{{body|safe}}</main></body></html>'''

def need_login(): return not session.get('u')
def esc(s): return str(s or '').replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')
def label(s): return {'active':'نشطة','late':'متأخرة الاشتراك','suspended':'معلقة','resigned':'مستقيل','pending':'قيد المراجعة','approved':'معتمدة','rejected':'مرفوضة'}.get(s,s or '-')
def nav(): return '<div class="card nav"><a href="/dashboard">الرئيسية</a><a href="/applications">طلبات العضوية</a><a href="/apply">طلب جديد</a><a href="/payments">الاشتراكات</a><a href="/reports">التقارير</a><a href="/change-password">كلمة المرور</a><a href="/logout">خروج</a></div>'
def next_no(c,prefix,table):
    n=c.execute(f'SELECT COALESCE(MAX(id),0)+1 n FROM {table}').fetchone()['n']; return f'{prefix}-{n:04d}'
def save_photo(f):
    if not f or not f.filename: return ''
    ext=os.path.splitext(secure_filename(f.filename))[1].lower()
    if ext not in ('.jpg','.jpeg','.png','.webp'): return ''
    name=f'{uuid.uuid4().hex}{ext}'; f.save(os.path.join(UPLOADS,name)); return name
def make_qr(member_no,token):
    try:
        import qrcode
        url=f'https://members.shamsphone.net/verify/{token}'
        fn=f'{member_no}.png'; qrcode.make(url).save(os.path.join(QRS,fn)); return fn
    except Exception: return ''

@app.route('/uploads/<path:name>')
def uploads(name): return send_from_directory(UPLOADS,name)
@app.route('/qrs/<path:name>')
def qrs(name): return send_from_directory(QRS,name)

@app.route('/',methods=['GET','POST'])
def login():
    if session.get('u'): return redirect('/dashboard')
    msg=''
    if request.method=='POST':
        c=db(); u=c.execute('SELECT * FROM users WHERE username=?',(request.form['u'].strip(),)).fetchone(); c.close()
        if u and check_password_hash(u['password'],request.form['p']): session.clear(); session.permanent=True; session['u']=u['username']; session['uid']=u['id']; session['role']=u['role']; return redirect('/dashboard')
        msg='بيانات الدخول غير صحيحة'
    b=f'''<div class="card" style="max-width:470px;margin:30px auto"><h2>تسجيل الدخول</h2><form method="post"><label>اسم المستخدم<input name="u" required></label><br><label>كلمة المرور<input type="password" name="p" required></label><br><button>دخول</button></form><p class="bad">{msg}</p></div>'''; return render_template_string(PAGE,body=b)

@app.route('/dashboard')
def dashboard():
    if need_login(): return redirect('/')
    q=request.args.get('q','').strip(); c=db()
    stats={'members':c.execute('SELECT COUNT(*) n FROM members').fetchone()['n'],'active':c.execute("SELECT COUNT(*) n FROM members WHERE status='active'").fetchone()['n'],'pending':c.execute("SELECT COUNT(*) n FROM applications WHERE status='pending'").fetchone()['n'],'money':c.execute('SELECT COALESCE(SUM(amount),0) n FROM payments').fetchone()['n']}
    if q:
        like=f'%{q}%'; members=c.execute('SELECT * FROM members WHERE name LIKE ? OR phone LIKE ? OR member_no LIKE ? ORDER BY id DESC',(like,like,like)).fetchall()
    else: members=c.execute('SELECT * FROM members ORDER BY id DESC LIMIT 100').fetchall()
    c.close(); rows=''.join(f"<tr><td><a href='/member/{m['id']}'>{esc(m['member_no'])}</a></td><td>{esc(m['name'])}</td><td>{esc(m['phone'])}</td><td><span class='badge'>{label(m['status'])}</span></td></tr>" for m in members)
    b=nav()+f'''<div class="grid"><div class="stat"><div class="kpi-title">الأعضاء المعتمدون</div><b>{stats['members']}</b></div><div class="stat"><div class="kpi-title">النشطون</div><b>{stats['active']}</b></div><div class="stat"><div class="kpi-title">طلبات تنتظر الاعتماد</div><b>{stats['pending']}</b></div><div class="stat"><div class="kpi-title">إجمالي التحصيل</div><b>{stats['money']:.2f}</b></div></div><div class="card"><form class="toolbar"><input style="flex:1" name="q" value="{esc(q)}" placeholder="بحث بالاسم أو رقم العضوية أو الهاتف"><button>بحث</button></form></div><div class="card"><h3 class="section-title">الأعضاء</h3><div style="overflow:auto"><table><tr><th>الرقم</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th></tr>{rows}</table></div></div>'''; return render_template_string(PAGE,body=b)

@app.route('/apply',methods=['GET','POST'])
def apply():
    if need_login(): return redirect('/')
    if request.method=='POST':
        c=db(); appno=next_no(c,'APP','applications'); photo=save_photo(request.files.get('photo'))
        c.execute('INSERT INTO applications(app_no,name,phone,address,dob,job,member_type,notes,photo) VALUES(?,?,?,?,?,?,?,?,?)',(appno,request.form['name'].strip(),request.form.get('phone','').strip(),request.form.get('address','').strip(),request.form.get('dob',''),request.form.get('job','').strip(),request.form.get('member_type','').strip(),request.form.get('notes','').strip(),photo)); c.commit(); c.close(); flash(f'تم حفظ الطلب برقم {appno}. لم يصدر رقم عضوية بعد.'); return redirect('/applications')
    b=nav()+'''<div class="card"><h2>طلب عضوية جديد</h2><p class="muted">يُسجل الطلب أولًا، ولا يصدر رقم العضوية الدائم إلا بعد الاعتماد.</p><form method="post" enctype="multipart/form-data" class="form"><label>الاسم الرباعي<input name="name" required></label><label>رقم الهاتف<input name="phone"></label><label>تاريخ الميلاد<input type="date" name="dob"></label><label>السكن<input name="address"></label><label>المهنة<input name="job"></label><label>نوع العضوية<input name="member_type" placeholder="حسب النظام الأساسي المعتمد"></label><label>الصورة الشخصية<input type="file" name="photo" accept="image/*"></label><label class="full">ملاحظات<textarea name="notes"></textarea></label><div class="full"><button>حفظ الطلب</button></div></form></div>'''; return render_template_string(PAGE,body=b)

@app.route('/applications')
def applications():
    if need_login(): return redirect('/')
    st=request.args.get('status','pending'); c=db(); apps=c.execute('SELECT * FROM applications WHERE status=? ORDER BY id DESC',(st,)).fetchall() if st in ('pending','approved','rejected') else c.execute('SELECT * FROM applications ORDER BY id DESC').fetchall(); c.close()
    rows=''.join(f"<tr><td><a href='/application/{a['id']}'>{esc(a['app_no'])}</a></td><td>{esc(a['name'])}</td><td>{esc(a['phone'])}</td><td>{label(a['status'])}</td><td>{esc(a['created_at'])}</td></tr>" for a in apps)
    b=nav()+f'''<div class="card"><div class="toolbar"><a class="btn" href="/applications?status=pending">قيد المراجعة</a><a class="btn" href="/applications?status=approved">معتمدة</a><a class="btn" href="/applications?status=rejected">مرفوضة</a><a class="btn" href="/applications?status=all">الكل</a></div></div><div class="card"><h2>طلبات العضوية ({len(apps)})</h2><div style="overflow:auto"><table><tr><th>رقم الطلب</th><th>الاسم</th><th>الهاتف</th><th>الحالة</th><th>التاريخ</th></tr>{rows}</table></div></div>'''; return render_template_string(PAGE,body=b)

@app.route('/application/<int:aid>',methods=['GET','POST'])
def application(aid):
    if need_login(): return redirect('/')
    c=db(); a=c.execute('SELECT * FROM applications WHERE id=?',(aid,)).fetchone()
    if not a: c.close(); return 'غير موجود',404
    if request.method=='POST' and a['status']=='pending':
        action=request.form.get('action'); note=request.form.get('note','').strip()
        if action=='approve':
            no=next_no(c,'WDN','members'); token=secrets.token_urlsafe(18)
            c.execute('INSERT INTO members(member_no,name,phone,address,status,dob,job,member_type,notes,photo,qr_token,approved_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(no,a['name'],a['phone'],a['address'],'active',a['dob'],a['job'],a['member_type'],a['notes'],a['photo'],token,datetime.utcnow().isoformat(timespec='seconds')))
            mid=c.execute('SELECT last_insert_rowid() id').fetchone()['id']; c.execute("UPDATE applications SET status='approved',reviewed_at=CURRENT_TIMESTAMP,review_note=?,member_id=? WHERE id=?",(note,mid,aid)); c.commit(); make_qr(no,token); c.close(); flash(f'تم اعتماد العضوية وإصدار الرقم {no}'); return redirect(f'/member/{mid}')
        if action=='reject': c.execute("UPDATE applications SET status='rejected',reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=?",(note,aid)); c.commit(); c.close(); flash('تم رفض الطلب مع الاحتفاظ بسجله'); return redirect('/applications')
    photo=f"<img class='photo' src='/uploads/{esc(a['photo'])}'>" if a['photo'] else ''
    controls='' if a['status']!='pending' else '''<form method="post"><label>ملاحظة القرار<textarea name="note"></textarea></label><div class="toolbar"><button name="action" value="approve">اعتماد وإصدار رقم عضوية</button><button class="danger" name="action" value="reject">رفض الطلب</button></div></form>'''
    b=nav()+f'''<div class="card"><div class="card-row">{photo}<div><h2>{esc(a['name'])}</h2><p><b>{esc(a['app_no'])}</b> — {label(a['status'])}</p><p>الهاتف: {esc(a['phone']) or '-'}</p><p>السكن: {esc(a['address']) or '-'}</p><p>المهنة: {esc(a['job']) or '-'}</p><p>نوع العضوية: {esc(a['member_type']) or '-'}</p></div></div><hr>{controls}</div>'''; c.close(); return render_template_string(PAGE,body=b)

@app.route('/member/<int:mid>',methods=['GET','POST'])
def member(mid):
    if need_login(): return redirect('/')
    c=db(); m=c.execute('SELECT * FROM members WHERE id=?',(mid,)).fetchone()
    if not m: c.close(); return 'غير موجود',404
    if request.method=='POST':
        st=request.form.get('status','active')
        if st in ('active','late','suspended','resigned'): c.execute('UPDATE members SET status=? WHERE id=?',(st,mid)); c.commit(); flash('تم تحديث حالة العضوية')
        c.close(); return redirect(f'/member/{mid}')
    pays=c.execute('SELECT * FROM payments WHERE member_id=? ORDER BY id DESC',(mid,)).fetchall(); total=c.execute('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE member_id=?',(mid,)).fetchone()['n']; c.close()
    photo=f"<img class='photo' src='/uploads/{esc(m['photo'])}'>" if m['photo'] else "<div class='photo'></div>"; qrfn=f"{m['member_no']}.png"; qr=f"<img class='qr' src='/qrs/{qrfn}'>" if os.path.exists(os.path.join(QRS,qrfn)) else ''
    prows=''.join(f"<tr><td>{esc(p['created_at'])}</td><td>{esc(p['kind'])}</td><td>{p['amount']:.2f}</td><td>{esc(p['receipt'])}</td><td>{esc(p['period'])}</td></tr>" for p in pays)
    b=nav()+f'''<div class="card member-card" id="membership-card"><div class="card-row">{photo}<div style="flex:1"><div class="muted" style="color:#d9e3f7">نادي ود نفيع الرياضي الثقافي الاجتماعي</div><h2>{esc(m['name'])}</h2><h3>{esc(m['member_no'])}</h3><p>{esc(m['member_type']) or 'عضوية النادي'} — {label(m['status'])}</p></div>{qr}</div></div><div class="card no-print"><div class="toolbar"><button onclick="window.print()">طباعة البطاقة</button><a class="btn" href="/verify/{esc(m['qr_token'])}" target="_blank">صفحة التحقق</a><a class="primary btn" href="/payments?member_id={mid}">تسجيل دفعة</a></div><p>الهاتف: {esc(m['phone']) or '-'}</p><p>السكن: {esc(m['address']) or '-'}</p><p>المهنة: {esc(m['job']) or '-'}</p><p>إجمالي المدفوع: <b>{total:.2f}</b></p><form method="post" class="toolbar"><select name="status"><option value="active">نشطة</option><option value="late">متأخرة الاشتراك</option><option value="suspended">معلقة</option><option value="resigned">مستقيل</option></select><button class="gold">تحديث الحالة</button></form></div><div class="card no-print"><h3>سجل المدفوعات</h3><div style="overflow:auto"><table><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>الإيصال</th><th>الفترة/البيان</th></tr>{prows}</table></div></div>'''; return render_template_string(PAGE,body=b)

@app.route('/verify/<token>')
def verify(token):
    c=db(); m=c.execute('SELECT * FROM members WHERE qr_token=?',(token,)).fetchone(); c.close()
    if not m: return render_template_string(PAGE,body='<div class="card"><h2 class="bad">رمز غير صالح</h2></div>'),404
    photo=f"<img class='photo' src='/uploads/{esc(m['photo'])}'>" if m['photo'] else ''
    b=f'''<div class="card" style="max-width:620px;margin:25px auto"><div class="card-row">{photo}<div><h2>{esc(m['name'])}</h2><h3>{esc(m['member_no'])}</h3><p>حالة العضوية: <b>{label(m['status'])}</b></p><p class="muted">هذه صفحة تحقق إلكتروني صادرة من نظام عضوية نادي ود نفيع.</p></div></div></div>'''; return render_template_string(PAGE,body=b)

@app.route('/payments',methods=['GET','POST'])
def payments():
    if need_login(): return redirect('/')
    c=db()
    if request.method=='POST':
        try:
            mid=int(request.form['member_id']); amount=float(request.form['amount']); receipt=request.form['receipt'].strip(); kind=request.form.get('kind','اشتراك عضوية').strip(); period=request.form.get('period','').strip()
            if amount<=0 or not receipt: raise ValueError()
            c.execute('INSERT INTO payments(member_id,amount,receipt,kind,period) VALUES(?,?,?,?,?)',(mid,amount,receipt,kind,period)); c.commit(); flash('تم تسجيل الدفعة')
        except Exception: flash('تعذر تسجيل الدفعة: تحقق من البيانات')
        c.close(); return redirect('/payments')
    ms=c.execute('SELECT id,member_no,name FROM members ORDER BY name').fetchall(); rows=c.execute('SELECT p.*,m.name,m.member_no FROM payments p JOIN members m ON m.id=p.member_id ORDER BY p.id DESC LIMIT 100').fetchall(); c.close(); selected=request.args.get('member_id','')
    opts=''.join(f"<option value='{m['id']}' {'selected' if str(m['id'])==selected else ''}>{esc(m['member_no'])} — {esc(m['name'])}</option>" for m in ms); prows=''.join(f"<tr><td>{esc(p['created_at'])}</td><td>{esc(p['member_no'])} — {esc(p['name'])}</td><td>{esc(p['kind'])}</td><td>{p['amount']:.2f}</td><td>{esc(p['receipt'])}</td><td>{esc(p['period'])}</td></tr>" for p in rows)
    b=nav()+f'''<div class="card"><h2>تسجيل دفعة</h2><form method="post" class="form"><label>العضو<select name="member_id" required><option value="">اختر العضو</option>{opts}</select></label><label>نوع المبلغ<input name="kind" value="اشتراك عضوية"></label><label>المبلغ<input type="number" step="0.01" min="0.01" name="amount" required></label><label>رقم الإيصال<input name="receipt" required></label><label class="full">الفترة / البيان<input name="period"></label><div class="full"><button>حفظ الدفعة</button></div></form></div><div class="card"><h3>آخر المدفوعات</h3><div style="overflow:auto"><table><tr><th>التاريخ</th><th>العضو</th><th>النوع</th><th>المبلغ</th><th>الإيصال</th><th>البيان</th></tr>{prows}</table></div></div>'''; return render_template_string(PAGE,body=b)

@app.route('/reports')
def reports():
    if need_login(): return redirect('/')
    c=db(); s={'apps':c.execute('SELECT COUNT(*) n FROM applications').fetchone()['n'],'pending':c.execute("SELECT COUNT(*) n FROM applications WHERE status='pending'").fetchone()['n'],'members':c.execute('SELECT COUNT(*) n FROM members').fetchone()['n'],'active':c.execute("SELECT COUNT(*) n FROM members WHERE status='active'").fetchone()['n'],'late':c.execute("SELECT COUNT(*) n FROM members WHERE status='late'").fetchone()['n'],'suspended':c.execute("SELECT COUNT(*) n FROM members WHERE status='suspended'").fetchone()['n'],'money':c.execute('SELECT COALESCE(SUM(amount),0) n FROM payments').fetchone()['n'],'payments':c.execute('SELECT COUNT(*) n FROM payments').fetchone()['n']}; c.close()
    b=nav()+f'''<div class="card"><h2>التقارير</h2><p class="muted">ملخص مباشر من قاعدة بيانات العضوية.</p></div><div class="grid"><div class="stat"><div class="kpi-title">كل الطلبات</div><b>{s['apps']}</b></div><div class="stat"><div class="kpi-title">تنتظر الاعتماد</div><b>{s['pending']}</b></div><div class="stat"><div class="kpi-title">الأعضاء المعتمدون</div><b>{s['members']}</b></div><div class="stat"><div class="kpi-title">النشطون</div><b>{s['active']}</b></div><div class="stat"><div class="kpi-title">متأخرو الاشتراك</div><b>{s['late']}</b></div><div class="stat"><div class="kpi-title">المعلقة</div><b>{s['suspended']}</b></div><div class="stat"><div class="kpi-title">عدد الدفعات</div><b>{s['payments']}</b></div><div class="stat"><div class="kpi-title">إجمالي التحصيل</div><b>{s['money']:.2f}</b></div></div><div class="card"><button onclick="window.print()">طباعة التقرير</button></div>'''; return render_template_string(PAGE,body=b)

@app.route('/change-password',methods=['GET','POST'])
def change_password():
    if need_login(): return redirect('/')
    if request.method=='POST':
        old=request.form['old']; new=request.form['new']; confirm=request.form['confirm']; c=db(); u=c.execute('SELECT * FROM users WHERE id=?',(session['uid'],)).fetchone()
        if not u or not check_password_hash(u['password'],old): flash('كلمة المرور الحالية غير صحيحة')
        elif len(new)<10: flash('كلمة المرور الجديدة يجب ألا تقل عن 10 أحرف')
        elif new!=confirm: flash('تأكيد كلمة المرور غير مطابق')
        else: c.execute('UPDATE users SET password=? WHERE id=?',(generate_password_hash(new),session['uid'])); c.commit(); session.clear(); c.close(); flash('تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة.'); return redirect('/')
        c.close()
    b=nav()+'''<div class="card" style="max-width:560px"><h2>تغيير كلمة المرور</h2><form method="post"><label>كلمة المرور الحالية<input type="password" name="old" required></label><br><label>كلمة المرور الجديدة<input type="password" name="new" minlength="10" required></label><br><label>تأكيد كلمة المرور<input type="password" name="confirm" minlength="10" required></label><br><button>حفظ كلمة المرور الجديدة</button></form></div>'''; return render_template_string(PAGE,body=b)

@app.route('/logout')
def logout(): session.clear(); return redirect('/')
