use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "hyvspecs",
    version,
    about = "share your machine's specs as a card"
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Gather system specifications and upload to create a showcase card
    Showcase(ShowcaseArgs),
    /// Log in via GitHub for verified handles
    Login,
    /// Claim an anonymous card into your GitHub handle
    Claim { card_id: String },
    /// Delete a specs card that you created
    Delete { card_id: String },
}

#[derive(Args)]
pub struct ShowcaseArgs {
    /// Attach a custom label or name to the specs card
    #[arg(long, short = 'l')]
    pub label: Option<String>,

    /// Publish under your verified GitHub handle (requires login)
    #[arg(long, short = 'v')]
    pub verify: bool,

    /// Print the collected system specifications as JSON instead of uploading
    #[arg(long, short = 'j')]
    pub json: bool,

    /// Build and display the specifications without uploading
    #[arg(long = "dry-run", short = 'd')]
    pub dry_run: bool,

    /// Automatically accept publication prompt without interactive confirmation
    #[arg(long, short = 'y')]
    pub yes: bool,

    /// Specify a custom card ID / URL slug instead of a randomly generated one
    #[arg(long, short = 'i')]
    pub id: Option<String>,
}
