const sinon = require("sinon");
const assert = require("better-assert");
const equal = require("deep-eql");
const inspect = require("util").inspect;
const format = require("util").format;
require("source-map-support").install();
const defaults = require("lodash.defaults");

const debug = false;
const logfn = debug ? console.log.bind(console) : function () {};
const logger = {debug: logfn, info: logfn, notice: logfn, warn: logfn, error: logfn, crit: logfn, alert: logfn, emerg: logfn};

const Client = require("../lib/client.js");
const NetSocket = require("@havvy/mock-net-socket")(sinon);

const networkConfig = {
    "server": "irc.test.net",
    "nicknames": ["testbot"],
    "username": "testuser",
    "realname": "tennu irc bot"
};

const messages = {
    rpl_welcome: ":irc.test.net 001 testbot :Welcome to the Test IRC Network testbot!testuser@localhost\r\n",
    rpl_cap_ls: ":irc.test.net CAP * LS :multi-prefix\r\n",
    rpl_ack_default_capabilities: ":irc.test.net CAP * ACK :multi-prefix\r\n",
    _: ""
};

describe("Tennu Client:", function () {
    var netsocket, client;

    beforeEach(function () {
        netsocket = NetSocket(logfn);
    });

    it("Basic Connecting and Disconnecting", function () {
        client = Client(networkConfig, {
            NetSocket: netsocket,
            Logger: logger
        });

        assert(client.connected === false);
        client.connect();
        assert(client._socket.isStarted() === true);
        assert(client._socket.isReady() === false);
        assert(client.connected === true);
        client.disconnect();
        assert(client.connected === false);
    });

    describe("Error handling", function () {
        it("tells you which methods are missing on the logger", function () {
            var config = networkConfig;

            try {
                Client(networkConfig, {
                    Logger: function () {
                        return {debug: logfn, info: logfn, notice: logfn, warn: logfn, error: logfn};
                    }
                });

                assert(false);
            } catch (e) {
                logfn(e.message);
                assert(e.message === "Logger passed to tennu.Client is missing the following methods: [ 'crit', 'alert', 'emerg' ]");
            }
        });
    });

    // TODO(Havvy): Move to 'config' plugin.
    describe("Capabilities always requires `multi-prefix`", function () {
        it("even when no capabilities passed", function () {
            var client = Client(networkConfig, {
                NetSocket: netsocket,
                Logger: logger
            });

            client.connect();

            client._socket.impl.acceptConnect();
            assert(client._socket.impl.write.called);
            assert(client._socket.impl.write.getCall(0).calledWithExactly("CAP LS\r\n", "utf-8"));
            client._socket.impl.acceptData(messages.rpl_cap_ls);
            assert(client._socket.impl.write.getCall(1).calledWithExactly("CAP REQ :multi-prefix\r\n", "utf-8"));
            client._socket.impl.acceptData(messages.rpl_ack_default_capabilities);
        });

        it("even when capabilities is passed without a requires property", function () {
            var config = defaults({capabilities: {}}, networkConfig);
            var client = Client(config, {
                NetSocket: netsocket,
                Logger: logger
            });

            client.connect();
            client._socket.impl.acceptConnect();
            assert(client._socket.impl.write.getCall(0).calledWithExactly("CAP LS\r\n", "utf-8"));
            client._socket.impl.acceptData(messages.rpl_cap_ls);
            assert(client._socket.impl.write.getCall(1).calledWithExactly("CAP REQ :multi-prefix\r\n", "utf-8"));
            client._socket.impl.acceptData(messages.rpl_ack_default_capabilities);
        });

        it("event when capabilities is passed a requires array property without them", function () {
            var config = defaults({ capabilities: { requires: [] } }, networkConfig);
            var client = Client(config, {
                NetSocket: netsocket,
                Logger: logger
            });

            client.connect();
            client._socket.impl.acceptConnect();
            assert(client._socket.impl.write.getCall(0).calledWithExactly("CAP LS\r\n", "utf-8"));
            client._socket.impl.acceptData(messages.rpl_cap_ls);
            assert(client._socket.impl.write.getCall(1).calledWithExactly("CAP REQ :multi-prefix\r\n", "utf-8"));
            client._socket.impl.acceptData(messages.rpl_ack_default_capabilities);
        });

        it("except when the daemon is 'twitch'", function () {
            var config = defaults({ daemon: "twitch" }, networkConfig);
            var client = Client(config, {
                NetSocket: netsocket,
                Logger: logger
            });

            client.connect();
            client._socket.impl.acceptConnect();
            assert(client._socket.impl.write.getCall(0).calledWithExactly("USER testuser 8 * :tennu irc bot\r\n", "utf-8"));
        });

        it("except when the daemon is 'irc2'", function () {
            var config = defaults({ daemon: "irc2" }, networkConfig);
            var client = Client(config, {
                NetSocket: netsocket,
                Logger: logger
            });

            client.connect();
            client._socket.impl.acceptConnect();
            assert(client._socket.impl.write.getCall(0).calledWithExactly("USER testuser 8 * :tennu irc bot\r\n", "utf-8"));
        });
    });

    describe("misc", function () {
        // This test triggers an assertion error in libuv somehow...
        it("with a complex config file", function () {
            const config = {
                "server": "irc.irc2.net",
                "password": null,
                "port": 6697,
                "tls": false,
                "nickname": "nicky",
                "username": "testuser",
                "realname": "bot in tennu",
                "channels": ["#aChannel"],
                "nickserv": "AuthServ@Services.irc2.net",
                "auth-password": "REDACTED",
                "plugins": [],
                "command-trigger": "!",
                "disable-help": false,
                "daemon": "irc2"
            };

            console.log(inspect(netsocket));

            client = Client(config, {
                NetSocket: netsocket,
                Logger: logger
            });
        });
    });
});