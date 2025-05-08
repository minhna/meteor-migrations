/* global Tinytest */
import { Migrations } from './migrations_server';

Tinytest.addAsync('Migrates up once and only once with async up function.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // First migration with async up function
  Migrations.add({
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
      run.push('u1');
    },
    version: 1,
  });

  // Migrate up
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  // Shouldn't do anything since we're already at the latest version
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);
});

Tinytest.addAsync('Migrates up once and back down with async up and down functions.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // Migration with async up and down functions
  Migrations.add({
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
      run.push('u1');
    },
    down: async function () {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async operation
      run.push('d1');
    },
    version: 1,
  });

  // Migrate up
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  // Migrate down
  await Migrations.migrateTo('0');
  test.equal(run, ['u1', 'd1']);
  test.equal(await Migrations.getVersion(), 0);
});

Tinytest.addAsync('Migrates up several times with async migrations.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // First migration
  Migrations.add({
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate async operation
      run.push('u1');
    },
    version: 1,
  });

  // Migrate up
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  // Add two more migrations out of order
  Migrations.add({
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 50));
      run.push('u4');
    },
    version: 4,
  });
  Migrations.add({
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 50));
      run.push('u3');
    },
    version: 3,
  });

  // Migrate up to latest
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1', 'u3', 'u4']);
  test.equal(await Migrations.getVersion(), 4);
});

Tinytest.addAsync('Tests migrating down with async down function.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // Add migrations
  Migrations.add({
    up: async function () {
      run.push('u1');
    },
    version: 1,
  });
  Migrations.add({
    up: async function () {
      run.push('u2');
    },
    version: 2,
  });
  Migrations.add({
    up: async function () {
      run.push('u3');
    },
    down: async function () {
      await new Promise((resolve) => setTimeout(resolve, 50));
      run.push('d3');
    },
    version: 3,
    name: 'Down Migration', // Give it a name
  });

  // Migrate up
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1', 'u2', 'u3']);
  test.equal(await Migrations.getVersion(), 3);

  // Migrate down to version 2
  await Migrations.migrateTo('2');
  test.equal(run, ['u1', 'u2', 'u3', 'd3']);
  test.equal(await Migrations.getVersion(), 2);

  // Should throw since migration u2 has no down method
  await test.throwsAsync(async function () {
    await Migrations.migrateTo('1');
  }, /Cannot migrate/);
  test.equal(run, ['u1', 'u2', 'u3', 'd3']);
  test.equal(await Migrations.getVersion(), 2);
});

Tinytest.addAsync('Tests migrating down to version 0 with async down functions.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  test.equal(await Migrations.getVersion(), 0);

  Migrations.add({
    up: async function () {
      run.push('u1');
    },
    down: async function () {
      run.push('d1');
    },
    version: 1,
  });

  // Migrate up
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  // Migrate down to version 0
  await Migrations.migrateTo(0);
  test.equal(run, ['u1', 'd1']);
  test.equal(await Migrations.getVersion(), 0);
});

Tinytest.addAsync('Checks that locking works correctly with async migrations.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // Add migration that attempts to start another migration within it
  Migrations.add({
    version: 1,
    up: async function () {
      run.push('u1');

      // Attempts a migration from within the migration, this should have no effect due to locking
      await Migrations.migrateTo('latest');
    },
  });

  // Migrate up, should only migrate once
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);
});

Tinytest.addAsync('Checks that version is updated if subsequent async migration fails.', async function (test) {
  const run = [];
  let shouldError = true;
  await Migrations._reset();

  // Add migrations
  Migrations.add({
    version: 1,
    up: async function () {
      run.push('u1');
    },
  });
  Migrations.add({
    version: 2,
    up: async function () {
      if (shouldError) {
        throw new Error('Error in migration');
      }
      run.push('u2');
    },
  });

  // Migrate up, which should throw
  await test.throwsAsync(async function () {
    await Migrations.migrateTo('latest');
  });
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  shouldError = false;
  // Migrate up again, should succeed
  await Migrations.unlock();
  await Migrations.migrateTo('latest');
  test.equal(run, ['u1', 'u2']);
  test.equal(await Migrations.getVersion(), 2);
});

Tinytest.addAsync('Does nothing for no migrations.', async function (test) {
  await Migrations._reset();

  // Shouldn't do anything
  await Migrations.migrateTo('latest');
  test.equal(await Migrations.getVersion(), 0);
});

Tinytest.addAsync('Checks that rerun works correctly with async migrations.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // Add migration
  Migrations.add({
    version: 1,
    up: async function () {
      run.push('u1');
    },
  });

  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  // Shouldn't migrate
  await Migrations.migrateTo(1);
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 1);

  // Should migrate again with rerun
  await Migrations.migrateTo('1,rerun');
  test.equal(run, ['u1', 'u1']);
  test.equal(await Migrations.getVersion(), 1);
});

Tinytest.addAsync('Checks that rerun works even if there are missing versions.', async function (test) {
  const run = []; // Keeps track of migrations
  await Migrations._reset();

  // Add migration with a missing step
  Migrations.add({
    version: 3,
    up: async function () {
      run.push('u1');
    },
  });

  await Migrations.migrateTo('latest');
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 3);

  // Shouldn't migrate
  await Migrations.migrateTo(3);
  test.equal(run, ['u1']);
  test.equal(await Migrations.getVersion(), 3);

  // Should migrate again with rerun
  await Migrations.migrateTo('3,rerun');
  test.equal(run, ['u1', 'u1']);
  test.equal(await Migrations.getVersion(), 3);
});

Tinytest.addAsync('Migration callbacks include the migration as an argument.', async function (test) {
  let contextArg;
  await Migrations._reset();

  // Add migration
  const migration = {
    version: 1,
    up: async function (m) {
      contextArg = m;
    },
  };
  Migrations.add(migration);

  await Migrations.migrateTo(1);
  test.equal(contextArg === migration, true);
});

Tinytest.addAsync('Migrations can log to injected logger.', async function (test) {
  await Migrations._reset();

  let calledDone = false;
  Migrations.options.logger = function () {
    if (!calledDone) {
      calledDone = true;
      test.isTrue(true);
    }
  };

  Migrations.add({ version: 1, up: async function () {} });
  await Migrations.migrateTo(1);

  Migrations.options.logger = null;
});

Tinytest.addAsync('Migrations should pass correct arguments to logger.', async function (test) {
  await Migrations._reset();

  let calledDone = false;
  const logger = function (opts) {
    if (!calledDone) {
      calledDone = true;
      test.include(opts, 'level');
      test.include(opts, 'message');
      test.include(opts, 'tag');
      test.equal(opts.tag, 'Migrations');
    }
  };

  Migrations.options.logger = logger;

  Migrations.add({ version: 1, up: async function () {} });
  await Migrations.migrateTo(1);

  Migrations.options.logger = null;
});

Tinytest.addAsync('Async migrations execute in order.', async function (test) {
  await Migrations._reset();
  const run = [];

  Migrations.add({
    version: 1,
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 100));
      run.push('u1');
    },
  });

  Migrations.add({
    version: 2,
    up: async function () {
      await new Promise((resolve) => setTimeout(resolve, 50));
      run.push('u2');
    },
  });

  Migrations.add({
    version: 3,
    up: async function () {
      run.push('u3');
    },
  });

  await Migrations.migrateTo('latest');
  test.equal(run, ['u1', 'u2', 'u3']);
});

Tinytest.addAsync('Fails migration when up is not a function.', async function (test) {
  await Migrations._reset();

  Migrations.add({
    version: 1,
    name: 'Failure of a migration',
    up: 'this should fail',
  });

  await test.throwsAsync(async function () {
    await Migrations.migrateTo('latest');
  }, /Migration must supply an up function/);
});