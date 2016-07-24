const sinon = require("sinon");
const assert = require("better-assert");
const equal = require("deep-eql");
const inspect = require("util").inspect;
const format = require("util").format;
require("source-map-support").install();

const defaults = require("lodash.defaults");

const debug = false;
const logfn = debug ? console.log.bind(console) : function () {};

const HelpPlugin = require("../tennu_plugins/help");
const CommandsPlugin = require("../tennu_plugins/commands");

const pluginHelps = {
    a: "a *",
    b: {
        b: {
            "*": "b *",
            b1: "b 1",
            b2: ["b 2_1", "b 2_2"],
            b3: {
                "*": "b 3 *"
            },
        },
    },
    c: {
        c1: "c 1"
    },
    d: ["d *_1", "d *_2"],
    e: "{{!}}e",
    f: ["{{!}}", "{{!}}"]
};

const defaultConfigObject = {
    "command-trigger": "@",
    "disable-help": HelpPlugin.configDefaults["disable-help"],
    "command-ignore-list": CommandsPlugin.configDefaults["command-ignore-list"],
    "help-helpfile": HelpPlugin.configDefaults["help-helpfile"]
};

const makeConfigFn = function (configChanges) {
    const config = defaults({}, configChanges, defaultConfigObject);

    return function (value) {
        if (value in config) {
            return config[value];
        } else {
            throw new Error(format("Error in testing: Plugin expects config value (%s) we don't have.", value));
        }
    }
};

const defaultConfigFn = makeConfigFn({});

describe("Help plugin", function () {
    var instance, help, HELP_NOT_FOUND, client;

    const config = function (opts) {
        client = {
            config: opts.config || defaultConfigFn
        };

        instance = HelpPlugin.init(client, {});
        HELP_NOT_FOUND = instance.exports.HELP_NOT_FOUND;

        instance.hooks.help("a", pluginHelps.a);
        instance.hooks.help("b", pluginHelps.b);
        instance.hooks.help("c", pluginHelps.c);
        instance.hooks.help("d", pluginHelps.d);
        instance.hooks.help("e", pluginHelps.e);
        instance.hooks.help("f", pluginHelps.f);

        help = instance.exports.help;
    }

    it("returns HELP_NOT_FOUND for unknown topics", function () {
        config({});
        assert(help(["dnd"]) === HELP_NOT_FOUND);
    });

    it("returns HELP_NOT_FOUND for subtopics of unknown topics", function () {
        config({});
        assert(help(["dne", "subtopic"]) === HELP_NOT_FOUND);
    });

    it("assigns the topic of the plugin name the value of the string when given a string", function () {
        config({});
        logfn(inspect(help(["a"])));
        assert(help(["a"]) === "a *");
    });

    it("assigns the topic of the plugin name the value of the array when given an array", function () {
        config({});
        logfn(inspect(help(["d"])));
        assert(equal(help(["d"]), ["d *_1", "d *_2"]));
    });

    it("gives the * property of topics with an object value", function () {
        config({});
        assert(help(["b"]) === "b *");
    });

    it("gives HELP_NOT_FOUND for topics with an object value without the * property", function () {
        config({});
        assert(help(["c"]) === HELP_NOT_FOUND);
    });

    it("gives the subtopic string value for subtopic type of string", function () {
        config({});
        logfn(inspect(help(["b", "b1"])));
        assert(help(["b", "b1"]) === "b 1");
    });

    it("gives the subtopic array value for subtopic type of array", function () {
        config({});
        logfn(inspect(help(["b", "b2"])));
        assert(equal(help(["b", "b2"]), ["b 2_1", "b 2_2"]));
    });

    it("gives the * property of subtopic type of object", function () {
        config({});
        logfn(inspect(help(["b", "b3"])));
        assert(help(["b", "b3"]) === "b 3 *");
    });

    it("gives HELP_NOT_FOUND for nonexistent subtopic of existing topic", function () {
        config({});
        logfn(inspect(help(["b", "b4"])));
        assert(help(["b", "b4"]) === HELP_NOT_FOUND);
    });

    it("replaces {{!}} with the command trigger (string)", function () {
        config({});
        logfn(inspect(help(["e"])));

        assert(help(["e"]) === "@e");
    });

    it("replaces {{!}} with the command trigger (array)", function () {
        config({});
        assert(equal(help(["f"]), ["@", "@"]));
    });

    describe("!commands", function () {
        it("shows installed commands", function () {
            config({});

            instance.hooks.commands("help", instance.commands);

            assert(equal(instance.handlers["!commands"](), ["List of known commands:", "help, commands"]));
        });

        it("shows installed commands from all plugins", function () {
            config({});

            instance.hooks.commands("help", instance.commands);
            instance.hooks.commands("test", ["a", "b"]);

            assert(equal(instance.handlers["!commands"](), ["List of known commands:", "help, commands, a, b"]));
        });

        it("doesn't show ignored commands", function () {
            config({config: makeConfigFn({"command-ignore-list": ["ignored"]})});

            instance.hooks.commands("test", ["a", "b", "ignored"]);

            assert(equal(instance.handlers["!commands"](), ["List of known commands:", "a, b"]));
        });
    });
});