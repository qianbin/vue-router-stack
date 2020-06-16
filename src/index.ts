import _Vue from 'vue'
import Router, { Route, RouteRecord } from 'vue-router'

const defaultSeqKey = 's~'
function makeSeq() {
    return Date.now().toString(16)
}

function decodeSeq(s: string) {
    try {
        return parseInt(s, 16)
    } catch{
        return 0
    }
}

export type Options = {
    router: Router
    seqKey?: string
}

export interface Entry extends Route {
    seq: number
}

export interface ScopedEntry extends Entry {
    record: RouteRecord
    component: Vue.Component
}

export interface Stack {
    full: Entry[]
    scoped: ScopedEntry[]
}

function getScopeRoot(vm: Vue, entries: Entry[]): [RouteRecord, number] | undefined {
    while (vm) {
        for (const e of entries) {
            for (let i = 0; i < e.matched.length; i++) {
                const m = e.matched[i]
                if (vm === m.instances.default) {
                    return [m, i]
                }
            }
        }
        vm = vm.$parent
    }
}

function eliminateUndefinedError(v: any) {
    if (v instanceof Promise) {
        return v.catch(err => {
            if (err) {
                throw err
            }
        })
    }
    return v
}

export default function install(Vue: typeof _Vue, options?: Options) {
    if (!options || !options.router) {
        throw new Error('invalid options')
    }

    const seqKey = options.seqKey || defaultSeqKey

    const router = options.router
    const stack = Vue.observable<{ entries: Entry[] }>({ entries: [] })

    Object.defineProperty(Vue.prototype, '$stack', {
        get(): Stack {
            const vm = this
            return {
                get full() { return stack.entries },
                get scoped() {
                    const root = getScopeRoot(vm, stack.entries)
                    if (!root) {
                        return []
                    }
                    const [rootRec, rootIndex] = root

                    let reversed = stack.entries.map(e => e).reverse()
                    const start = reversed.findIndex(e => e.matched[rootIndex] === rootRec && e.matched[rootIndex + 1])
                    if (start < 0) {
                        return []
                    }


                    reversed = reversed.slice(start)
                    const end = reversed.findIndex(e => e.matched[rootIndex] !== rootRec || !e.matched[rootIndex + 1])
                    if (end >= 0) {
                        reversed = reversed.slice(0, end)
                    }

                    return reversed
                        .reverse()
                        .map<ScopedEntry>(e => {
                            const rec = e.matched[rootIndex + 1]
                            return {
                                ...e,
                                get record() { return rec },
                                get component() { return rec.components.default as Vue.Component }
                            }
                        })
                }
            }
        }
    })

    let replacing = true
    const replaceFn = router.replace.bind(router)
    const pushFn = router.push.bind(router)
    router.replace = <any>((loc: any, onComplete: any, onAbort: any) => {
        replacing = true
        return eliminateUndefinedError(replaceFn(loc, onComplete, onAbort))
    })
    router.push = <any>((loc: any, onComplete: any, onAbort: any) => {
        return eliminateUndefinedError(pushFn(loc, onComplete, onAbort))
    })

    router.beforeEach((to, from, next) => {
        if (to.query[seqKey]) {
            return next()
        }
        const query = { ...to.query }
        query[seqKey] = makeSeq()
        next({
            ...to,
            name: to.name || undefined,
            query,
            replace: replacing
        })
    })
    router.afterEach((to, from) => {
        const seq = decodeSeq(to.query[seqKey] as string)

        const i = stack.entries.findIndex(e => e.seq >= seq)
        if (i >= 0) {
            stack.entries.splice(i)
        } else if (replacing) {
            stack.entries.pop()
        }
        stack.entries.push({
            ...to,
            seq
        })

        // 
        replacing = false
    })
}

declare module 'vue/types/vue' {
    interface Vue {
        $stack: Stack
    }
}
