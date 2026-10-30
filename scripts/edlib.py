B = "/app/frontend/src/tfl/"


def edit(path, pairs):
    p = B + path
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (path, a[:90])
        s = s.replace(a, b)
    open(p, "w").write(s)


def cut(path, start, end, new):
    p = B + path
    s = open(p).read()
    a = s.index(start)
    b = s.index(end, a)
    s = s[:a] + new + s[b:]
    open(p, "w").write(s)
